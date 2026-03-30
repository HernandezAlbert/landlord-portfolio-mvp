import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  decisionToApplicantStatus,
  formatApplicantStatus,
  formatMoney,
  getApplicantStatusTone,
  getEffectiveDecision,
  getScreeningLabel,
  getScreeningTone,
  normalizeApplicantStatus,
} from "@/lib/applicants";
import { computeReferencingScore } from "@/lib/referencing";
import { getIncomeBreakdownFromRawPayload } from "@/lib/google-form-import";
import { allApplicantMessageDrafts } from "@/lib/applicant-messaging";
import MessageTemplatesPanel from "./MessageTemplatesPanel";

const MANUAL_DECISION_OPTIONS = [
  { value: "", label: "Use system decision" },
  { value: "ACCEPT", label: "Accept" },
  { value: "ACCEPT_WITH_GUARANTOR", label: "Accept with guarantor" },
  { value: "REVIEW", label: "Review" },
  { value: "DECLINE", label: "Decline" },
] as const;

const WORKFLOW_STATUS_OPTIONS = [
  { value: "APPLIED", label: "Applied" },
  { value: "REFERENCING", label: "Referencing" },
  { value: "APPROVED", label: "Approved" },
  { value: "DECLINED", label: "Declined" },
  { value: "REJECTED", label: "Applicant rejected" },
  { value: "MORE_INFO_REQUESTED", label: "Applicant requested for more info / guarantor" },
  { value: "WITHDRAWN", label: "Withdrawn" },
] as const;

const PET_FIELD_TOKENS = ["pet", "pets", "animal", "breed", "dog", "cat"];

async function getRent(propertyId?: string | null, advertisedRent?: number | null) {
  if (advertisedRent && advertisedRent > 0) return advertisedRent;
  if (!propertyId) return null;

  const activeTenancy = await prisma.tenancy.findFirst({
    where: { propertyId, isActive: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return activeTenancy?.rentMonthly ?? null;
}

function formatFieldLabel(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => stringifyValue(item)).filter(Boolean).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normaliseRawPayload(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const entries = Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) => [key, stringifyValue(value)] as const)
    .filter(([, value]) => value);
  return Object.fromEntries(entries);
}

function isPetField(key: string) {
  const lower = key.toLowerCase();
  return PET_FIELD_TOKENS.some((token) => lower.includes(token));
}

function buildPetSummary(rawPayload: Record<string, string>, applicant: { hasPets: boolean; petDetails?: string | null }) {
  const petEntries = Object.entries(rawPayload).filter(([key]) => isPetField(key));
  const parts = petEntries.map(([key, value]) => `${formatFieldLabel(key)}: ${value}`);
  if (applicant.petDetails) parts.unshift(applicant.petDetails);
  return Array.from(new Set(parts.filter(Boolean))).join("\n");
}

export default async function ApplicantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const qs = (await searchParams) ?? {};
  const success = typeof qs.success === "string" ? decodeURIComponent(qs.success) : "";
  const error = typeof qs.error === "string" ? decodeURIComponent(qs.error) : "";
  const messageError = typeof qs.messageError === "string" ? decodeURIComponent(qs.messageError) : "";
  const messageSent = typeof qs.messageSent === "string" ? decodeURIComponent(qs.messageSent) : "";

  const applicant = await prisma.applicant.findUnique({
    where: { id },
    include: { property: true, referencing: true },
  });

  if (!applicant) notFound();

  async function saveDecisionAndStatus(formData: FormData) {
    "use server";
    const manualDecisionRaw = String(formData.get("manualDecision") ?? "").trim();
    const manualDecision = manualDecisionRaw || null;
    const manualReason = String(formData.get("manualDecisionReason") ?? "").trim() || null;
    const statusInput = normalizeApplicantStatus(String(formData.get("status") ?? "").trim());

    await prisma.referencingCheck.upsert({
      where: { applicantId: id },
      create: {
        applicantId: id,
        manualDecision,
        manualDecisionReason: manualReason,
      },
      update: {
        manualDecision,
        manualDecisionReason: manualReason,
      },
    });

    if (statusInput) {
      await prisma.applicant.update({
        where: { id },
        data: { status: statusInput },
      });
    }

    revalidatePath(`/applicants/${id}`);
    revalidatePath("/applicants");
    redirect(`/applicants/${id}?success=${encodeURIComponent("Final decision and workflow status updated.")}`);
  }

  async function saveNotes(formData: FormData) {
    "use server";
    const notes = String(formData.get("notes") ?? "").trim() || null;
    await prisma.applicant.update({ where: { id }, data: { notes } });
    revalidatePath(`/applicants/${id}`);
    revalidatePath("/applicants");
    redirect(`/applicants/${id}?success=${encodeURIComponent("Applicant notes updated.")}`);
  }

  async function archiveApplicant() {
    "use server";
    await prisma.applicant.update({ where: { id }, data: { deletedAt: new Date() } });
    revalidatePath("/applicants");
    redirect(`/applicants?archived=1&success=${encodeURIComponent("Applicant archived.")}`);
  }

  async function restoreApplicant() {
    "use server";
    await prisma.applicant.update({ where: { id }, data: { deletedAt: null } });
    revalidatePath(`/applicants/${id}`);
    revalidatePath("/applicants");
    redirect(`/applicants/${id}?success=${encodeURIComponent("Applicant restored from archive.")}`);
  }

  async function deleteArchivedApplicant() {
    "use server";
    const existing = await prisma.applicant.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!existing?.deletedAt) {
      redirect(`/applicants/${id}?error=${encodeURIComponent("Only archived applicants can be permanently deleted.")}`);
    }
    await prisma.referencingCheck.deleteMany({ where: { applicantId: id } });
    await prisma.applicant.delete({ where: { id } });
    revalidatePath("/applicants");
    redirect(`/applicants?archived=1&success=${encodeURIComponent("Archived applicant deleted permanently.")}`);
  }

  const rentMonthly = await getRent(applicant.propertyId, applicant.property?.advertisedRentMonthly ?? null);
  const incomeBreakdown = getIncomeBreakdownFromRawPayload(applicant.importRawPayload);
  const effectiveIncome = incomeBreakdown.totalMonthlyPence ?? applicant.monthlyIncome;
  const effectiveGuarantorAvailable = applicant.referencing?.guarantorProvided ?? applicant.canProvideGuarantor ?? false;

  const result = computeReferencingScore({
    monthlyIncome: effectiveIncome,
    rentMonthly,
    employmentStatus: applicant.employmentStatus,
    idProvided: applicant.referencing?.idProvided,
    rightToRentChecked: applicant.referencing?.rightToRentChecked,
    payslipsProvided: applicant.referencing?.payslipsProvided,
    bankStatementsProvided: applicant.referencing?.bankStatementsProvided,
    employmentReference: applicant.referencing?.employmentReference,
    landlordReference: applicant.referencing?.landlordReference,
    incomeVerified: applicant.referencing?.incomeVerified,
    creditCheckPassed: applicant.referencing?.creditCheckPassed,
    guarantorRequired: applicant.referencing?.guarantorRequired,
    guarantorProvided: effectiveGuarantorAvailable,
    petInsuranceProvided: applicant.referencing?.petInsuranceProvided,
    hasPets: applicant.hasPets,
    savingsBufferMonths: applicant.savingsBufferMonths,
  });

  const systemDecision = result.decision;
  const effectiveDecision = getEffectiveDecision({
    computedDecision: systemDecision,
    manualDecision: applicant.referencing?.manualDecision ?? null,
  });

  const effectiveStatus = applicant.status === "WITHDRAWN"
    ? "WITHDRAWN"
    : applicant.status === "REJECTED" || applicant.status === "MORE_INFO_REQUESTED"
      ? applicant.status
      : decisionToApplicantStatus(effectiveDecision);

  const drafts = allApplicantMessageDrafts(applicant);
  const rawPayload = normaliseRawPayload(applicant.importRawPayload);
  const rawEntries = Object.entries(rawPayload).filter(([key]) => !isPetField(key));
  const petSummary = buildPetSummary(rawPayload, applicant);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={applicant.deletedAt ? "/applicants?archived=1" : "/applicants"} className="text-sm text-blue-600 hover:underline">
          ← Back to applicants
        </Link>
      </div>

      {success ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {messageError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{messageError}</div> : null}
      {messageSent ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{messageSent}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{applicant.fullName}</h1>
            <p className="mt-1 text-sm text-slate-500">{applicant.property?.name ?? "No property linked"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getApplicantStatusTone(effectiveStatus)}`}>
              Status: {formatApplicantStatus(effectiveStatus)}
            </span>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getApplicantStatusTone(effectiveDecision)}`}>
              Decision: {effectiveDecision}
            </span>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getScreeningTone(applicant.screeningStatus)}`}>
              Screening: {getScreeningLabel(applicant.screeningStatus)}
            </span>
            {applicant.deletedAt ? (
              <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Archived
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Affordability</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Income</span>
              <span className="font-medium">{effectiveIncome ? formatMoney(effectiveIncome) : "Not provided"}</span>
            </div>
            {incomeBreakdown.baseMonthlyPence ? (
              <div className="flex items-center justify-between">
                <span>Base income</span>
                <span className="font-medium">{formatMoney(incomeBreakdown.baseMonthlyPence)}</span>
              </div>
            ) : null}
            {incomeBreakdown.additionalMonthlyPence ? (
              <div className="flex items-center justify-between">
                <span>Additional income</span>
                <span className="font-medium">{formatMoney(incomeBreakdown.additionalMonthlyPence)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span>Rent</span>
              <span className="font-medium">{result.rentUsed ? formatMoney(result.rentUsed) : "Not set"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ratio</span>
              <span className="font-medium">{result.affordabilityRatio !== null ? `${result.affordabilityRatio.toFixed(2)}x` : "Cannot assess"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Guarantor</span>
              <span className="font-medium">{effectiveGuarantorAvailable ? "Available" : "Not offered"}</span>
            </div>
            <div className="border-t border-slate-100 pt-2" />
            <div className="flex items-center justify-between">
              <span>Minimum required</span>
              <span className="font-medium">{result.thresholds.minimum.toFixed(1)}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Preferred (pass)</span>
              <span className="font-medium">{result.thresholds.preferred.toFixed(1)}x</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Screening</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Screening status</span>
              <span className="font-medium">{getScreeningLabel(applicant.screeningStatus)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Screening score</span>
              <span className="font-medium">{applicant.screeningScore ?? "—"}</span>
            </div>
            <div className="border-t border-slate-100 pt-2" />
            <p className="text-sm text-slate-600">{applicant.screeningReason ?? "No screening reason recorded for this applicant."}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Referencing</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between"><span>System decision</span><span className="font-medium">{systemDecision}</span></div>
            <div className="flex items-center justify-between"><span>Effective decision</span><span className="font-medium">{effectiveDecision}</span></div>
            <div className="flex items-center justify-between"><span>Workflow status</span><span className="font-medium">{formatApplicantStatus(applicant.status)}</span></div>
            <div className="flex items-center justify-between"><span>Score</span><span className="font-medium">{result.score}/100</span></div>
            {applicant.referencing?.manualDecision ? (
              <>
                <div className="border-t border-slate-100 pt-2" />
                <div className="text-xs text-slate-500">Manual override active</div>
                {applicant.referencing?.manualDecisionReason ? <div className="text-sm text-slate-600">{applicant.referencing.manualDecisionReason}</div> : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Final decision & workflow</h2>
          <p className="mt-1 text-sm text-slate-500">Override the final decision when needed and set the applicant workflow status after review.</p>
          <form action={saveDecisionAndStatus} className="mt-4 space-y-4">
            <label className="grid gap-1 text-sm">
              Final decision
              <select name="manualDecision" defaultValue={applicant.referencing?.manualDecision ?? ""} className="rounded-lg border px-3 py-2">
                {MANUAL_DECISION_OPTIONS.map((option) => (
                  <option key={option.value || "system"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Workflow status
              <select name="status" defaultValue={applicant.status} className="rounded-lg border px-3 py-2">
                {WORKFLOW_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Decision / status note
              <textarea
                name="manualDecisionReason"
                rows={4}
                defaultValue={applicant.referencing?.manualDecisionReason ?? ""}
                className="rounded-lg border px-3 py-2"
                placeholder="Why this was overridden, rejected, or moved to more-info/guarantor."
              />
            </label>
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Save decision and status
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Applicant notes</h2>
          <p className="mt-1 text-sm text-slate-500">Store landlord notes for callbacks, concerns, or next actions.</p>
          <form action={saveNotes} className="mt-4 space-y-4">
            <textarea
              name="notes"
              rows={8}
              defaultValue={applicant.notes ?? ""}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Add notes for this applicant"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Save notes
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Archive controls</h2>
            <p className="mt-1 text-sm text-slate-500">Archive applicants to keep the active list tidy. Permanently deleting is only available from archive.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {applicant.deletedAt ? (
              <>
                <form action={restoreApplicant}>
                  <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Restore applicant
                  </button>
                </form>
                <form action={deleteArchivedApplicant}>
                  <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                    Delete archived applicant
                  </button>
                </form>
              </>
            ) : (
              <form action={archiveApplicant}>
                <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Archive applicant
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Decision reasoning</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {result.reasons.length ? result.reasons.map((reason, idx) => <li key={idx} className="rounded-lg bg-slate-50 px-3 py-2">{reason}</li>) : <li className="rounded-lg bg-slate-50 px-3 py-2">No decision reasoning available.</li>}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Risks</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {result.risks.length ? result.risks.map((risk, idx) => <li key={idx} className="rounded-lg bg-amber-50 px-3 py-2">{risk}</li>) : <li className="rounded-lg bg-slate-50 px-3 py-2">No material risks flagged.</li>}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Imported Google form data</h2>
        <p className="mt-1 text-sm text-slate-500">Shows the raw imported Google Form fields for this applicant, with pet fields summarised separately.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Pets declared</div>
            <div className="mt-1 text-sm text-slate-800">{applicant.hasPets ? "Yes" : "No"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Pet summary</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{applicant.hasPets ? (petSummary || "Pets declared, but no further pet details were provided.") : "No pets declared."}</div>
          </div>
          {rawEntries.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{formatFieldLabel(key)}</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{value}</div>
            </div>
          ))}
          {!rawEntries.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:col-span-2">
              No raw Google Form payload is stored for this applicant.
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Applicant email templates</h2>
        <p className="mt-1 text-sm text-slate-500">Use a template, review it, and send it directly from here.</p>
        {!applicant.email ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">This applicant does not have an email address, so sending is disabled.</div> : null}
        <MessageTemplatesPanel drafts={drafts} applicantId={applicant.id} disabled={!applicant.email} />
      </div>
    </div>
  );
}

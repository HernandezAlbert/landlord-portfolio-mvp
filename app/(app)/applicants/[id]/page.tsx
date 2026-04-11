import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  decisionToApplicantStatus,
  formatApplicantStatus,
  formatMoney,
  getApplicantStatusFromDecision,
  getApplicantStatusTone,
  getDecisionTone,
  getEffectiveDecision,
  getScreeningLabel,
  getScreeningTone,
  normalizeApplicantStatus,
  referencingCompletionPercentage,
} from "@/lib/applicants";
import { computeReferencingScore } from "@/lib/referencing";
import {
  APPLICANT_DOC_TYPES,
  buildMissingDocumentEmail,
  documentTypeLabel,
  getUploadedApplicantDocs,
} from "@/lib/applicant-documents";
import { getIncomeBreakdownFromRawPayload } from "@/lib/google-form-import";
import { allApplicantMessageDrafts } from "@/lib/applicant-messaging";
import MessageTemplatesPanel from "./MessageTemplatesPanel";
import GuarantorSummaryCard from "@/components/guarantors/guarantor-summary-card";
import { getDecisionWithGuarantor } from "@/lib/guarantor-decision";
import ToastBridge from "@/components/ui/toast-bridge";

async function getRent(propertyId?: string | null, advertisedRent?: number | null) {
  if (advertisedRent && advertisedRent > 0) return advertisedRent;
  if (!propertyId) return null;

  const activeTenancy = await prisma.tenancy.findFirst({
    where: { propertyId, isActive: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return activeTenancy?.rentMonthly ?? null;
}

function fmtDate(value?: Date | null) {
  if (!value) return "—";
  return value.toISOString().slice(0, 10);
}

function prettyKey(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function yesNo(value?: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function isPetField(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("pet");
}

function summarizePetDetails(rawPayload: unknown, fallback?: string | null) {
  const payload =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? (rawPayload as Record<string, unknown>)
      : null;

  const petLines: string[] = [];
  if (payload) {
    for (const [key, value] of Object.entries(payload)) {
      if (!isPetField(key)) continue;
      const text = String(value ?? "").trim();
      if (!text) continue;
      petLines.push(`${prettyKey(key)}: ${text}`);
    }
  }

  if (petLines.length) return petLines.join("\n");
  return fallback?.trim() || "";
}

function importedFieldEntries(rawPayload: unknown) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return [] as Array<[string, string]>;
  }

  return Object.entries(rawPayload as Record<string, unknown>)
    .filter(([key, value]) => !isPetField(key) && String(value ?? "").trim() !== "")
    .map(([key, value]) => [prettyKey(key), String(value ?? "").trim()] as [string, string]);
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
  const uploadStatus = typeof qs.upload === "string" ? qs.upload : "";
  const deleteDocStatus = typeof qs.deleteDoc === "string" ? qs.deleteDoc : "";
  const savedStatus = typeof qs.saved === "string" ? qs.saved : "";
  const toastCode = typeof qs.toast === "string" ? qs.toast : "";
  const toastMessage =
    toastCode === "guarantor-deleted"
      ? "Guarantor deleted."
      : null;
  const applicant = await prisma.applicant.findUnique({
  where: { id },
  include: {
    property: true,
    referencing: true,
    guarantors: {
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
    },
  },
});



  if (!applicant) notFound();

  const safeApplicant = applicant;

  async function saveApplicantControls(formData: FormData) {
    "use server";

    const manualDecisionRaw = String(formData.get("manualDecision") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const statusRaw = String(formData.get("status") ?? safeApplicant.status).trim();
    const manualDecisionReason = String(formData.get("manualDecisionReason") ?? "").trim();

    const allowedStatuses = new Set([
    "APPLIED",
    "REFERENCING",
    "APPROVED",
    "DECLINED",
    "REJECTED",
    "MORE_INFO_REQUESTED",
    "WITHDRAWN",
  ]);

  const nextStatus =
    normalizeApplicantStatus(statusRaw) && allowedStatuses.has(statusRaw)
      ? (statusRaw as typeof safeApplicant.status)
      : safeApplicant.status;

    const manualDecision =
      manualDecisionRaw === "ACCEPT" ||
      manualDecisionRaw === "ACCEPT_WITH_GUARANTOR" ||
      manualDecisionRaw === "REVIEW" ||
      manualDecisionRaw === "DECLINE"
        ? manualDecisionRaw
        : null;

    await prisma.applicant.update({
      where: { id: safeApplicant.id },
      data: {
        notes: notes || null,
        status: nextStatus as typeof safeApplicant.status,
        referencing: {
          upsert: {
            create: {
              manualDecision,
              manualDecisionReason: manualDecision ? manualDecisionReason || null : null,
            },
            update: {
              manualDecision,
              manualDecisionReason: manualDecision ? manualDecisionReason || null : null,
            },
          },
        },
      },
    });

    revalidatePath(`/applicants/${safeApplicant.id}`);
    redirect(`/applicants/${safeApplicant.id}?saved=1`);
  }

  const rentMonthly = await getRent(applicant.propertyId, applicant.property?.advertisedRentMonthly ?? null);
  const incomeBreakdown = getIncomeBreakdownFromRawPayload(applicant.importRawPayload);
  const effectiveIncome = incomeBreakdown.totalMonthlyPence ?? applicant.monthlyIncome;

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
    guarantorProvided: applicant.referencing?.guarantorProvided ?? applicant.canProvideGuarantor ?? false,
    petInsuranceProvided: applicant.referencing?.petInsuranceProvided,
    hasPets: applicant.hasPets,
    savingsBufferMonths: applicant.savingsBufferMonths,
  });

  const systemDecision = result.decision;

const baseDecision = getEffectiveDecision({
  computedDecision: systemDecision,
  manualDecision: applicant.referencing?.manualDecision ?? null,
});

const effectiveDecision: typeof baseDecision = getDecisionWithGuarantor({
  currentDecision: baseDecision,
  guarantorRequired: applicant.referencing?.guarantorRequired,
  guarantorOutcome: applicant.guarantorOutcome,
}) as typeof baseDecision;

  const derivedStatus = getApplicantStatusFromDecision({
  decision: effectiveDecision,
  currentStatus: applicant.status,
});

  const uploadedDocs = await getUploadedApplicantDocs(applicant.id);
  const completion = referencingCompletionPercentage(applicant.referencing);
  const importedFields = importedFieldEntries(applicant.importRawPayload);
  const petSummary = summarizePetDetails(applicant.importRawPayload, applicant.petDetails);
  const missingDocEmail = buildMissingDocumentEmail({
    applicantName: applicant.fullName,
    propertyName: applicant.property?.name,
    uploadedDocs,
    referencing: applicant.referencing,
    hasPets: applicant.hasPets,
  });
  const drafts = allApplicantMessageDrafts(applicant);

  return (
    <div className="space-y-6">
      <ToastBridge message={toastMessage} variant="success" />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{applicant.fullName}</h1>
            <p className="mt-1 text-sm text-slate-500">{applicant.property?.name ?? "No property linked"}</p>
            <p className="mt-1 text-xs text-slate-400">
              Submitted: {fmtDate(applicant.importSubmittedAt ?? applicant.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getApplicantStatusTone(
                applicant.status,
              )}`}
            >
              Workflow: {formatApplicantStatus(applicant.status)}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getDecisionTone(
                effectiveDecision,
              )}`}
            >
              Final decision: {effectiveDecision}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getScreeningTone(
                applicant.screeningStatus,
              )}`}
            >
              Screening: {getScreeningLabel(applicant.screeningStatus)}
            </span>

            <Link
            href={`/guarantors/new?applicantId=${applicant.id}`}
            className="inline-flex items-center rounded-md bg-black px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
          >
            Add Guarantor
          </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/applicants" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
            Back to applicants
          </Link>
          {applicant.email ? (
            <a
              href={`mailto:${applicant.email}`}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Email applicant
            </a>
          ) : null}
        </div>
      </div>

      {savedStatus ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Applicant details saved.
        </div>
      ) : null}
      {uploadStatus === "ok" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Reference material uploaded successfully.
        </div>
      ) : null}
      {uploadStatus === "empty" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Please choose a file before uploading.
        </div>
      ) : null}
      {deleteDocStatus === "ok" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Uploaded file deleted.
        </div>
      ) : null}
      {deleteDocStatus === "missing" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No document was selected for deletion.
        </div>
      ) : null}
      
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Affordability</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Base monthly income</span>
              <span className="font-medium">
                {incomeBreakdown.baseMonthlyPence ? formatMoney(incomeBreakdown.baseMonthlyPence) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Additional monthly income</span>
              <span className="font-medium">
                {incomeBreakdown.additionalMonthlyPence ? formatMoney(incomeBreakdown.additionalMonthlyPence) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total income used</span>
              <span className="font-medium">{effectiveIncome ? formatMoney(effectiveIncome) : "Not provided"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Rent used</span>
              <span className="font-medium">{result.rentUsed ? formatMoney(result.rentUsed) : "Not set"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ratio</span>
              <span className="font-medium">
                {result.affordabilityRatio !== null ? `${result.affordabilityRatio.toFixed(2)}x` : "Cannot assess"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Guarantor available</span>
              <span className="font-medium">
                {applicant.referencing?.guarantorProvided ?? applicant.canProvideGuarantor ? "Yes" : "No"}
              </span>
            </div>
            <div className="border-t border-slate-100 pt-2" />
            <div className="flex items-center justify-between">
              <span>Minimum required</span>
              <span className="font-medium">{result.thresholds.minimum.toFixed(1)}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Preferred</span>
              <span className="font-medium">{result.thresholds.preferred.toFixed(1)}x</span>
            </div>
          </div>
        </div>
        
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Screening</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="font-medium">{getScreeningLabel(applicant.screeningStatus)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Score</span>
              <span className="font-medium">{applicant.screeningScore ?? "—"}</span>
            </div>
            <div className="border-t border-slate-100 pt-2" />
            <p className="text-sm text-slate-600">
              {applicant.screeningReason ?? "No screening reason recorded for this applicant."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Referencing</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>System decision</span>
              <span className="font-medium">{systemDecision}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Final decision</span>
              <span className="font-medium">{effectiveDecision}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Derived status</span>
              <span className="font-medium">{derivedStatus}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Score</span>
              <span className="font-medium">{result.score}/100</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Completion</span>
              <span className="font-medium">
                {completion.percent}% ({completion.completed}/{completion.total})
              </span>
            </div>
            {applicant.referencing?.manualDecision ? (
              <>
                <div className="border-t border-slate-100 pt-2" />
                <div className="text-xs text-slate-500">Manual override active</div>
                {applicant.referencing.manualDecisionReason ? (
                  <div className="text-sm text-slate-600">{applicant.referencing.manualDecisionReason}</div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Guarantor</h2>

          <GuarantorSummaryCard
            applicantId={applicant.id}
            guarantors={applicant.guarantors}
            guarantorRequired={applicant.guarantorRequired}
            guarantorAvailable={applicant.guarantorAvailable}
            guarantorOutcome={applicant.guarantorOutcome}
          />
        </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Applicant controls</h2>
          <p className="mt-1 text-sm text-slate-500">
            Amend the final decision, workflow status, and notes without losing the underlying screening result.
          </p>

          <form action={saveApplicantControls} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-800">Manual final decision</span>
              <select
                name="manualDecision"
                defaultValue={applicant.referencing?.manualDecision ?? ""}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Use system decision</option>
                <option value="ACCEPT">Accept</option>
                <option value="ACCEPT_WITH_GUARANTOR">Accept with guarantor</option>
                <option value="REVIEW">Review</option>
                <option value="DECLINE">Decline</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-800">Workflow status</span>
              <select
                name="status"
                defaultValue={applicant.status}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="APPLIED">Applied</option>
                <option value="REFERENCING">Referencing</option>
                <option value="APPROVED">Approved</option>
                <option value="DECLINED">Declined</option>
                <option value="REJECTED">Applicant rejected</option>
                <option value="MORE_INFO_REQUESTED">Requested more info / guarantor</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-800">Manual decision reason</span>
              <textarea
                name="manualDecisionReason"
                defaultValue={applicant.referencing?.manualDecisionReason ?? ""}
                rows={3}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Why you overrode the system decision"
              />
            </label>

            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-800">Applicant notes</span>
              <textarea
                name="notes"
                defaultValue={applicant.notes ?? ""}
                rows={5}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Internal notes"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Save applicant controls
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Reference materials upload</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload supporting documents and assign a type so referencing can stay in sync.
          </p>

          <form
            action={`/api/applicants/${applicant.id}/documents`}
            method="post"
            encType="multipart/form-data"
            className="mt-4 space-y-4"
          >
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-800">Document type</span>
              <select
                name="docType"
                defaultValue="OTHER"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {APPLICANT_DOC_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {documentTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-800">Choose file</span>
              <input
                name="file"
                type="file"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Upload reference material
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-800">Outstanding document request summary</div>
            <div className="mt-2 text-sm text-slate-600">
              {missingDocEmail.missingItems.length ? (
                <ul className="list-disc space-y-1 pl-5">
                  {missingDocEmail.missingItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <div>No missing documents currently flagged.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Uploaded reference materials</h2>
            <p className="mt-1 text-sm text-slate-500">This is the upload list and dropdown-driven classification that was missing.</p>
          </div>
          <div className="text-sm text-slate-500">{uploadedDocs.length} file(s)</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left font-medium">Type</th>
                <th className="p-2 text-left font-medium">File</th>
                <th className="p-2 text-left font-medium">Uploaded</th>
                <th className="p-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {uploadedDocs.map((doc) => (
                <tr key={`${doc.storedName}-${doc.absolutePath}`} className="border-t border-slate-100">
                  <td className="p-2">{documentTypeLabel(doc.docType)}</td>
                  <td className="p-2">
                    <a
                      href={doc.filePath}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {doc.originalName}
                    </a>
                  </td>
                  <td className="p-2">{fmtDate(doc.createdAt)}</td>
                  <td className="p-2">
                    <form action={`/api/applicants/${applicant.id}/documents/delete`} method="post">
                      <input type="hidden" name="storedName" value={doc.storedName} />
                      <button type="submit" className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!uploadedDocs.length ? (
                <tr className="border-t border-slate-100">
                  <td className="p-3 text-slate-500" colSpan={4}>
                    No reference materials uploaded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Decision reasoning</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {result.reasons.length ? (
              result.reasons.map((reason, idx) => (
                <li key={idx} className="rounded-lg bg-slate-50 px-3 py-2">
                  {reason}
                </li>
              ))
            ) : (
              <li className="rounded-lg bg-slate-50 px-3 py-2">No decision reasoning available.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Risks</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {result.risks.length ? (
              result.risks.map((risk, idx) => (
                <li key={idx} className="rounded-lg bg-amber-50 px-3 py-2">
                  {risk}
                </li>
              ))
            ) : (
              <li className="rounded-lg bg-slate-50 px-3 py-2">No material risks flagged.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Referencing checklist</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Photo ID</div>
            <div className="mt-1 font-medium">{yesNo(applicant.referencing?.idProvided)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Right to Rent</div>
            <div className="mt-1 font-medium">{yesNo(applicant.referencing?.rightToRentChecked)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Payslips</div>
            <div className="mt-1 font-medium">{yesNo(applicant.referencing?.payslipsProvided)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Bank statements</div>
            <div className="mt-1 font-medium">{yesNo(applicant.referencing?.bankStatementsProvided)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Employer reference</div>
            <div className="mt-1 font-medium">{yesNo(applicant.referencing?.employmentReference)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Landlord reference</div>
            <div className="mt-1 font-medium">{yesNo(applicant.referencing?.landlordReference)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Guarantor provided</div>
            <div className="mt-1 font-medium">{yesNo(applicant.referencing?.guarantorProvided)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Pet insurance</div>
            <div className="mt-1 font-medium">{yesNo(applicant.referencing?.petInsuranceProvided)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Imported Google Form data</h2>
        <p className="mt-1 text-sm text-slate-500">
          All imported fields are shown below except pet-specific fields, which are summarised separately.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Pets declared</div>
            <div className="mt-1 whitespace-pre-wrap font-medium">{yesNo(applicant.hasPets)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm md:col-span-2">
            <div className="text-slate-500">Pet summary</div>
            <div className="mt-1 whitespace-pre-wrap font-medium">{petSummary || "—"}</div>
          </div>

          {importedFields.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="text-slate-500">{key}</div>
              <div className="mt-1 whitespace-pre-wrap font-medium text-slate-900">{value}</div>
            </div>
          ))}

          {!importedFields.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 md:col-span-2">
              No raw imported Google Form fields are available for this applicant.
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Applicant email templates</h2>
        <p className="mt-1 text-sm text-slate-500">Use a template, review it, and send it directly from here.</p>
        {!applicant.email ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            This applicant does not have an email address, so sending is disabled.
          </div>
        ) : null}
        <MessageTemplatesPanel drafts={drafts} applicantId={applicant.id} disabled={!applicant.email} />
      </div>

    

    </div>    
  );
}
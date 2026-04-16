import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { computeReferencingScore } from "@/lib/referencing";
import {
  formatApplicantStatus,
  formatMoney,
  formatScreeningStatus,
  getApplicantStatusFromDecision,
  getApplicantStatusTone,
  getDecisionTone,
  getScreeningTone,
  getEffectiveDecision,
  referencingCompletionPercentage,
} from "@/lib/applicants";
import {
  coerceGoogleSheetCsvUrl,
  getIncomeBreakdownFromRawPayload,
  mapGoogleFormRows,
} from "@/lib/google-form-import";
import { buildApplicantDuplicateKeys } from "@/lib/applicant-import-utils";
import { upsertImportedApplicant } from "@/lib/applicant-import-upsert";

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

async function getApplicantDocumentCount(applicantId: string) {
  const folder = path.join(
    process.cwd(),
    "public",
    "uploads",
    "applicants",
    applicantId,
  );
  try {
    const files = await fs.readdir(folder);
    return files.length;
  } catch {
    return 0;
  }
}

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const qs = (await searchParams) ?? {};
  const importError =
    typeof qs.importError === "string" ? decodeURIComponent(qs.importError) : "";
  const importStatus =
    typeof qs.imported === "string" ? decodeURIComponent(qs.imported) : "";
  const cleanupStatus =
    typeof qs.cleanup === "string" ? decodeURIComponent(qs.cleanup) : "";
  const success =
    typeof qs.success === "string" ? decodeURIComponent(qs.success) : "";
  const archivedMode =
    typeof qs.archived === "string" && qs.archived === "1";

  const user = await requireSessionUser();

  const [applicants, properties] = await Promise.all([
    prisma.applicant.findMany({
      where: archivedMode
        ? { userId: user.id, deletedAt: { not: null } }
        : { userId: user.id, deletedAt: null },
      include: { property: true, referencing: true },
      orderBy: archivedMode ? { deletedAt: "desc" } : { createdAt: "desc" },
    }),
    prisma.property.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  const [activeCount, archivedCount] = await Promise.all([
    prisma.applicant.count({ where: { userId: user.id, deletedAt: null } }),
    prisma.applicant.count({
      where: { userId: user.id, deletedAt: { not: null } },
    }),
  ]);

  const propertyRentMap = new Map(
    properties.map((property) => [property.id, property.advertisedRentMonthly ?? null]),
  );

  for (const tenancy of await prisma.tenancy.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      property: {
        userId: user.id,
        deletedAt: null,
      },
    },
    select: { propertyId: true, rentMonthly: true },
    orderBy: { createdAt: "desc" },
  })) {
    if (!propertyRentMap.get(tenancy.propertyId)) {
      propertyRentMap.set(tenancy.propertyId, tenancy.rentMonthly);
    }
  }

  async function createApplicant(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const propertyIdRaw = String(formData.get("propertyId") ?? "").trim() || null;
    const employmentStatus =
      String(formData.get("employmentStatus") ?? "").trim() || null;
    const monthlyIncomePounds = Number(formData.get("monthlyIncome") ?? 0);
    const requestedMoveIn = String(formData.get("requestedMoveIn") ?? "").trim();
    const adults = Math.max(1, Number(formData.get("adults") ?? 1) || 1);
    const children = Math.max(0, Number(formData.get("children") ?? 0) || 0);
    const hasPets = String(formData.get("hasPets") ?? "false") === "true";
    const petDetails = String(formData.get("petDetails") ?? "").trim() || null;
    const savingsBufferMonths =
      Number(formData.get("savingsBufferMonths") ?? 0) || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!fullName) redirect("/applicants");

    let propertyId: string | null = null;

    if (propertyIdRaw) {
      const ownedProperty = await prisma.property.findFirst({
        where: {
          id: propertyIdRaw,
          userId: currentUser.id,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!ownedProperty) {
        redirect(
          "/applicants?importError=" +
            encodeURIComponent("Invalid property selection."),
        );
      }

      propertyId = ownedProperty.id;
    }

    const applicant = await prisma.applicant.create({
      data: {
        userId: currentUser.id,
        fullName,
        email,
        phone,
        propertyId,
        employmentStatus,
        monthlyIncome: monthlyIncomePounds
          ? Math.round(monthlyIncomePounds * 100)
          : null,
        requestedMoveIn: requestedMoveIn ? new Date(requestedMoveIn) : null,
        adults,
        children,
        hasPets,
        petDetails,
        savingsBufferMonths,
        status: "APPLIED",
        notes,
        referencing: { create: {} },
      },
    });

    redirect(`/applicants/${applicant.id}`);
  }

  async function importGoogleFormResponses(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    let redirectUrl = "/applicants";

    try {
      const sourceUrl = String(formData.get("googleSheetCsvUrl") ?? "").trim();
      const propertyIdRaw = String(formData.get("importPropertyId") ?? "").trim();

      if (!propertyIdRaw) {
        throw new Error("You must assign a property before importing applicants.");
      }

      const propertyId = propertyIdRaw;
      const csvUrl = coerceGoogleSheetCsvUrl(sourceUrl);

      const response = await fetch(csvUrl, {
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 landlord-portfolio-importer",
          Accept: "text/csv,text/plain,*/*",
        },
      });

      if (!response.ok) {
        throw new Error(`Could not download CSV (${response.status}).`);
      }

      const csvText = await response.text();
      const parsedRows = mapGoogleFormRows(csvText);

      if (!parsedRows.length) {
        throw new Error(
          "No valid applicant rows were found. Check the Google Sheet tab and column headings.",
        );
      }

      const propertyForImport = await prisma.property.findFirst({
        where: {
          id: propertyId,
          userId: currentUser.id,
          deletedAt: null,
        },
        include: {
          tenancies: {
            where: { propertyId, deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: { rentMonthly: true },
            take: 1,
          },
        },
      });

      if (!propertyForImport) {
        throw new Error("Invalid property selected for import.");
      }

      const rentMonthly =
        propertyForImport.advertisedRentMonthly ??
        propertyForImport.tenancies[0]?.rentMonthly ??
        null;

      let importedCount = 0;
      let updatedCount = 0;

      const existingApplicants = await prisma.applicant.findMany({
        where: { userId: currentUser.id, deletedAt: null, propertyId },
        select: {
          id: true,
          importExternalKey: true,
          email: true,
          phone: true,
          fullName: true,
          importSubmittedAt: true,
        },
      });

      for (const row of parsedRows) {
        const result = await upsertImportedApplicant({
          userId: currentUser.id,
          propertyId,
          row,
          rentMonthly,
          passMultiplier: propertyForImport.screeningPassMultiplier ?? 3,
          guarantorMinMultiplier:
            propertyForImport.screeningGuarantorMinMultiplier ?? 2.0,
          importSource: "GOOGLE_FORM",
          existingApplicants,
        });

        if (result.action === "created") importedCount += 1;
        else updatedCount += 1;
      }

      revalidatePath("/applicants");
      redirectUrl = `/applicants?imported=${encodeURIComponent(
        `Imported ${importedCount} new row(s). Updated ${updatedCount} existing row(s).`,
      )}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      redirectUrl = `/applicants?importError=${encodeURIComponent(message)}`;
    }

    redirect(redirectUrl);
  }

  async function dedupeImportedApplicants() {
    "use server";

    const currentUser = await requireSessionUser();

    const importedApplicants = await prisma.applicant.findMany({
      where: {
        userId: currentUser.id,
        deletedAt: null,
        importSource: { in: ["GOOGLE_FORM", "GOOGLE_FORM_AUTO"] },
      },
      include: { referencing: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const keepersByKey = new Map<string, string>();
    const duplicateIds = new Set<string>();

    for (const applicant of importedApplicants) {
      const keys = buildApplicantDuplicateKeys({
        importExternalKey: applicant.importExternalKey,
        email: applicant.email,
        phone: applicant.phone,
        fullName: applicant.fullName,
        importSubmittedAt: applicant.importSubmittedAt,
      });

      let isDuplicate = false;
      for (const key of keys) {
        const keeperId = keepersByKey.get(key);
        if (keeperId && keeperId !== applicant.id) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) {
        duplicateIds.add(applicant.id);
        continue;
      }

      for (const key of keys) keepersByKey.set(key, applicant.id);
    }

    if (duplicateIds.size) {
      await prisma.applicant.updateMany({
        where: {
          userId: currentUser.id,
          id: { in: Array.from(duplicateIds) },
        },
        data: { deletedAt: new Date() },
      });
    }

    revalidatePath("/applicants");
    redirect(
      `/applicants?cleanup=${encodeURIComponent(
        `Deduplicated ${duplicateIds.size} imported applicant(s).`,
      )}`,
    );
  }

  async function archiveApplicant(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/applicants");

    await prisma.applicant.updateMany({
      where: { id, userId: currentUser.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/applicants");
    redirect(`/applicants?success=${encodeURIComponent("Applicant archived.")}`);
  }

  async function restoreApplicant(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/applicants?archived=1");

    await prisma.applicant.updateMany({
      where: { id, userId: currentUser.id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });

    revalidatePath("/applicants");
    redirect(
      `/applicants?archived=1&success=${encodeURIComponent(
        "Applicant restored.",
      )}`,
    );
  }

  async function deleteArchivedApplicant(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/applicants?archived=1");

    const existing = await prisma.applicant.findFirst({
      where: { id, userId: currentUser.id },
      select: { deletedAt: true },
    });

    if (!existing?.deletedAt) {
      redirect(
        `/applicants?archived=1&importError=${encodeURIComponent(
          "Only archived applicants can be deleted permanently.",
        )}`,
      );
    }

    await prisma.referencingCheck.deleteMany({ where: { applicantId: id } });
    await prisma.applicant.deleteMany({
      where: { id, userId: currentUser.id },
    });

    revalidatePath("/applicants");
    redirect(
      `/applicants?archived=1&success=${encodeURIComponent(
        "Archived applicant deleted permanently.",
      )}`,
    );
  }

  const enriched = await Promise.all(
    applicants.map(async (a) => {
      const result = computeReferencingScore({
        monthlyIncome:
          getIncomeBreakdownFromRawPayload(a.importRawPayload).totalMonthlyPence ??
          a.monthlyIncome,
        rentMonthly: a.propertyId ? propertyRentMap.get(a.propertyId) ?? null : null,
        employmentStatus: a.employmentStatus,
        idProvided: a.referencing?.idProvided,
        rightToRentChecked: a.referencing?.rightToRentChecked,
        payslipsProvided: a.referencing?.payslipsProvided,
        bankStatementsProvided: a.referencing?.bankStatementsProvided,
        employmentReference: a.referencing?.employmentReference,
        landlordReference: a.referencing?.landlordReference,
        incomeVerified: a.referencing?.incomeVerified,
        creditCheckPassed: a.referencing?.creditCheckPassed,
        guarantorRequired: a.referencing?.guarantorRequired,
        guarantorProvided: a.referencing?.guarantorProvided ?? a.canProvideGuarantor,
        petInsuranceProvided: a.referencing?.petInsuranceProvided,
        hasPets: a.hasPets,
        savingsBufferMonths: a.savingsBufferMonths,
      });

      const computedDecision = result.decision;
      const manualDecision = a.referencing?.manualDecision ?? null;
      const effectiveDecision = getEffectiveDecision({
        computedDecision,
        manualDecision,
      });
      const effectiveStatus = getApplicantStatusFromDecision({
        decision: effectiveDecision,
        currentStatus: a.status,
      });

      const importedIncome = getIncomeBreakdownFromRawPayload(a.importRawPayload);
      const effectiveIncome = importedIncome.totalMonthlyPence ?? a.monthlyIncome;

      return {
        ...a,
        incomeBreakdown: importedIncome,
        effectiveIncome,
        displayScore: result.score,
        computedDecision,
        manualDecision,
        displayDecision: effectiveDecision,
        effectiveStatus,
        completion: referencingCompletionPercentage(a.referencing),
        missingItems: result.risks?.length ?? 0,
        documentCount: await getApplicantDocumentCount(a.id),
      };
    }),
  );

  const stats = {
    total: enriched.length,
    inPipeline: enriched.filter((a) =>
      ["APPLIED", "REFERENCING", "MORE_INFO_REQUESTED"].includes(a.effectiveStatus),
    ).length,
    approved: enriched.filter((a) => a.effectiveStatus === "APPROVED").length,
    averageScore: enriched.length
      ? Math.round(
          enriched.reduce((sum, a) => sum + a.displayScore, 0) / enriched.length,
        )
      : 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Applicants &amp; Referencing
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track applicants, manual decisions, notes, archive state, document
            uploads, referencing progress and conversion into live tenants.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/applicants"
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              !archivedMode
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Active applicants ({activeCount})
          </Link>
          <Link
            href="/applicants?archived=1"
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              archivedMode
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Archive ({archivedCount})
          </Link>
        </div>
      </div>

      {importError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {importError}
        </div>
      ) : null}
      {importStatus ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {importStatus}
        </div>
      ) : null}
      {cleanupStatus ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {cleanupStatus}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          [archivedMode ? "Archived applicants" : "Visible applicants", stats.total],
          ["In pipeline", stats.inPipeline],
          ["Approved", stats.approved],
          ["Avg score", stats.averageScore],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
          </div>
        ))}
      </section>

      {!archivedMode ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Applicant cleanup tools
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Use this after testing imports to remove duplicate imported
                  applicants while keeping the earliest record.
                </p>
              </div>
              <form action={dedupeImportedApplicants}>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Deduplicate imported applicants
                </button>
              </form>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Import Google Form responses
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Keep this tucked away unless you are importing a new batch.
                  </p>
                </div>
                <span className="details-chip">Open import</span>
              </summary>
              <p className="mt-4 text-sm text-slate-500">
                Paste either the Google Sheet share link or the CSV export link.
                The importer converts it to CSV, updates matching rows, ignores
                blank rows, and maps your current RM9 pre-screening headers
                automatically.
              </p>
              <form
                action={importGoogleFormResponses}
                className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end"
              >
                <label className="grid gap-1 text-sm">
                  Google Sheet CSV URL
                  <input
                    name="googleSheetCsvUrl"
                    className="rounded-lg border px-3 py-2"
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=0"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Assign to property
                  <select
                    name="importPropertyId"
                    className="rounded-lg border px-3 py-2"
                    defaultValue=""
                    required
                  >
                    <option value="">Select property (required)</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Import / update rows
                </button>
              </form>
            </details>

            <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Add applicant
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a manual applicant only when needed.
                  </p>
                </div>
                <span className="details-chip">Open form</span>
              </summary>
              <form action={createApplicant} className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Full name
                  <input
                    name="fullName"
                    className="rounded-lg border px-3 py-2"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Property
                  <select
                    name="propertyId"
                    className="rounded-lg border px-3 py-2"
                    defaultValue=""
                  >
                    <option value="">Unassigned</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.postcode}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Email
                  <input name="email" className="rounded-lg border px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">
                  Phone
                  <input name="phone" className="rounded-lg border px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">
                  Employment status
                  <input
                    name="employmentStatus"
                    placeholder="Permanent / Contract / Self-employed"
                    className="rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Monthly income (£)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="monthlyIncome"
                    className="rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Requested move-in date
                  <input
                    type="date"
                    name="requestedMoveIn"
                    className="rounded-lg border px-3 py-2"
                  />
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="grid gap-1 text-sm">
                    Adults
                    <input
                      type="number"
                      min="1"
                      name="adults"
                      defaultValue={1}
                      className="rounded-lg border px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Children
                    <input
                      type="number"
                      min="0"
                      name="children"
                      defaultValue={0}
                      className="rounded-lg border px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Savings buffer (months)
                    <input
                      type="number"
                      min="0"
                      name="savingsBufferMonths"
                      defaultValue={0}
                      className="rounded-lg border px-3 py-2"
                    />
                  </label>
                </div>
                <div className="grid gap-2">
                  <label className="grid gap-1 text-sm">
                    Pets?
                    <select
                      name="hasPets"
                      defaultValue="false"
                      className="rounded-lg border px-3 py-2"
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Pet details
                    <input
                      name="petDetails"
                      placeholder="Type / breed / age"
                      className="rounded-lg border px-3 py-2"
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-sm md:col-span-2">
                  Notes
                  <textarea
                    name="notes"
                    rows={3}
                    className="rounded-lg border px-3 py-2"
                  />
                </label>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Create applicant
                  </button>
                </div>
              </form>
            </details>
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-600">
          Archived applicants are hidden from the live workflow. Restore them to
          bring them back into the active list, or delete them permanently here.
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Applicant</th>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Income</th>
              <th className="px-4 py-3 font-medium">Screening</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Decision</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((a) => (
              <tr key={a.id} className="border-t border-slate-200 align-top">
                <td className="px-4 py-3">
                  <Link
                    href={`/applicants/${a.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {a.fullName}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Pill className={getApplicantStatusTone(a.effectiveStatus)}>
                      {formatApplicantStatus(a.effectiveStatus)}
                    </Pill>
                    {a.manualDecision ? (
                      <Pill className="border-violet-200 bg-violet-50 text-violet-700">
                        Manual override
                      </Pill>
                    ) : null}
                    <Pill className="border-slate-200 bg-slate-50 text-slate-700">
                      {a.documentCount} docs
                    </Pill>
                    {a.deletedAt ? (
                      <Pill className="border-slate-300 bg-slate-100 text-slate-700">
                        Archived
                      </Pill>
                    ) : null}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {a.email ?? a.phone ?? "No contact details"}
                  </div>
                </td>
                <td className="px-4 py-3">{a.property?.name ?? "Unassigned"}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">
                    {formatMoney(a.effectiveIncome)}
                  </div>
                  {a.incomeBreakdown.additionalMonthlyPence ? (
                    <div className="mt-1 space-y-1 text-xs text-slate-500">
                      <div>
                        Base: {formatMoney(a.incomeBreakdown.baseMonthlyPence)}
                      </div>
                      <div>
                        Additional:{" "}
                        {formatMoney(a.incomeBreakdown.additionalMonthlyPence)}
                      </div>
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <Pill className={getScreeningTone(a.screeningStatus)}>
                    {formatScreeningStatus(a.screeningStatus)}
                  </Pill>
                  <div className="mt-2 text-xs text-slate-500">
                    {a.screeningSummary ?? "Initial screen passed."}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-900">
                    {a.completion.percent}% complete
                  </div>
                  <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${a.completion.percent}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {a.missingItems} risk item(s)
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Pill className={getDecisionTone(a.displayDecision)}>
                    {a.displayDecision}
                  </Pill>
                  <div className="mt-2 text-xs text-slate-500">
                    Score: {a.displayScore}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {a.importSource ?? "Manual"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/applicants/${a.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open
                    </Link>
                    {!archivedMode ? (
                      <form action={archiveApplicant}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Archive
                        </button>
                      </form>
                    ) : (
                      <>
                        <form action={restoreApplicant}>
                          <input type="hidden" name="id" value={a.id} />
                          <button
                            type="submit"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Restore
                          </button>
                        </form>
                        <form action={deleteArchivedApplicant}>
                          <input type="hidden" name="id" value={a.id} />
                          <button
                            type="submit"
                            className="w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {enriched.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-slate-500">
                  {archivedMode ? "No archived applicants." : "No applicants yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
import { prisma } from "@/lib/prisma";
import { sendEmailSafe } from "@/lib/email";
import { mapGoogleFormTable } from "@/lib/google-form-import";
import { readGoogleSheetValues } from "@/lib/google-sheets";
import { upsertImportedApplicant } from "@/lib/applicant-import-upsert";


export type PropertySyncOutcome = {
  propertyId: string;
  propertyName: string;
  imported: number;
  updated: number;
  skipped: number;
  checkedRows: number;
  skippedReason?: string;
  error?: string;
};

function eligibleForAutomaticImport(property: { tenancies: { id: string; isActive?: boolean }[]; googleFormImportEnabled: boolean; googleSheetId: string | null; googleSheetTabName: string | null; }) {
  const hasActiveTenancy = property.tenancies.some((tenancy) => tenancy.isActive === true);
  return property.googleFormImportEnabled && !!property.googleSheetId && !!property.googleSheetTabName && !hasActiveTenancy;
}

function buildApplicantNotificationEmail(args: {
  propertyName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  decision: string;
  screeningStatus: string;
  screeningSummary: string;
}) {
  const subject = `Landlord Portfolio — New applicant imported for ${args.propertyName}`;
  const lines = [
    `Property: ${args.propertyName}`,
    `Applicant: ${args.fullName}`,
    `Email: ${args.email ?? "—"}`,
    `Phone: ${args.phone ?? "—"}`,
    `Pre-screen decision: ${args.decision}`,
    `Screening status: ${args.screeningStatus}`,
    `Summary: ${args.screeningSummary}`,
  ];
  return {
    subject,
    text: lines.join("\n"),
    html: `<div><p><strong>Property:</strong> ${args.propertyName}</p><p><strong>Applicant:</strong> ${args.fullName}</p><p><strong>Email:</strong> ${args.email ?? "—"}</p><p><strong>Phone:</strong> ${args.phone ?? "—"}</p><p><strong>Pre-screen decision:</strong> ${args.decision}</p><p><strong>Screening status:</strong> ${args.screeningStatus}</p><p><strong>Summary:</strong> ${args.screeningSummary}</p></div>`,
  };
}

export async function syncApplicantsForProperty(propertyId: string, options?: { sendEmails?: boolean }) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      tenancies: { where: { deletedAt: null }, select: { id: true, rentMonthly: true, isActive: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!property || property.deletedAt) {
    return { propertyId, propertyName: "Unknown property", imported: 0, updated: 0, skipped: 0, checkedRows: 0, error: "Property not found." } satisfies PropertySyncOutcome;
  }

  if (!eligibleForAutomaticImport(property)) {
    return {
      propertyId: property.id,
      propertyName: property.name,
      imported: 0,
      updated: 0,
      skipped: 0,
      checkedRows: 0,
      skippedReason: property.tenancies.some((tenancy) => tenancy.isActive === true) ? "Property has an active tenancy." : "Google Form import is not fully configured.",
    } satisfies PropertySyncOutcome;
  }

  try {
    const table = await readGoogleSheetValues(property.googleSheetId!, `${property.googleSheetTabName}`);
    const parsedRows = mapGoogleFormTable(table);
    const candidateRows = parsedRows;
    const rentMonthly = property.advertisedRentMonthly ?? property.tenancies[0]?.rentMonthly ?? null;
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let lastImportedRow = Math.max(property.googleLastImportedRow ?? 1, parsedRows.length + 1);
    const existingApplicants = await prisma.applicant.findMany({
      where: { deletedAt: null, propertyId: property.id },
      select: { id: true, importExternalKey: true, email: true, phone: true, fullName: true, importSubmittedAt: true },
    });

    for (const row of candidateRows) {
      const result = await upsertImportedApplicant({
        propertyId: property.id,
        row,
        rentMonthly,
        passMultiplier: property.screeningPassMultiplier,
        guarantorMinMultiplier: property.screeningGuarantorMinMultiplier,
        importSource: "GOOGLE_FORM_AUTO",
        existingApplicants,
      });

      if (result.action === "created") {
        imported += 1;

        if (options?.sendEmails !== false && process.env.EMAIL_TO) {
          const applicant = await prisma.applicant.findUnique({
            where: { id: result.applicantId },
            select: {
              screeningStatus: true,
              screeningSummary: true,
              referencing: { select: { decision: true } },
            },
          });
          const email = buildApplicantNotificationEmail({
            propertyName: property.name,
            fullName: row.fullName,
            email: row.email ?? null,
            phone: row.phone ?? null,
            decision: applicant?.referencing?.decision ?? "REVIEW",
            screeningStatus: applicant?.screeningStatus ?? "REVIEW",
            screeningSummary: applicant?.screeningSummary ?? "Review",
          });
          await sendEmailSafe({ to: process.env.EMAIL_TO, subject: email.subject, html: email.html, text: email.text });
        }
      } else {
        updated += 1;
      }
    }

    await prisma.property.update({
      where: { id: property.id },
      data: {
        googleLastImportedRow: lastImportedRow,
        googleLastCheckedAt: new Date(),
        googleLastImportedAt: imported > 0 || updated > 0 ? new Date() : property.googleLastImportedAt,
        googleSyncError: null,
      },
    });

    return { propertyId: property.id, propertyName: property.name, imported, updated, skipped, checkedRows: candidateRows.length } satisfies PropertySyncOutcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    await prisma.property.update({
      where: { id: property.id },
      data: { googleLastCheckedAt: new Date(), googleSyncError: message.slice(0, 5000) },
    });
    return { propertyId: property.id, propertyName: property.name, imported: 0, updated: 0, skipped: 0, checkedRows: 0, error: message } satisfies PropertySyncOutcome;
  }
}

export async function syncApplicantsForEligibleProperties(options?: { sendEmails?: boolean }) {
  const properties = await prisma.property.findMany({
    where: { deletedAt: null, googleFormImportEnabled: true },
    include: {
      tenancies: { where: { isActive: true, deletedAt: null }, select: { id: true, isActive: true } },
    },
    orderBy: { name: "asc" },
  });

  const results: PropertySyncOutcome[] = [];
  for (const property of properties) {
    if (!eligibleForAutomaticImport(property)) {
      results.push({
        propertyId: property.id,
        propertyName: property.name,
        imported: 0,
        updated: 0,
        skipped: 0,
        checkedRows: 0,
        skippedReason: property.tenancies.some((tenancy) => tenancy.isActive === true) ? "Property has an active tenancy." : "Google Form import is not fully configured.",
      });
      continue;
    }
    results.push(await syncApplicantsForProperty(property.id, options));
  }
  return results;
}

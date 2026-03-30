import { prisma } from "@/lib/prisma";
import { getApplicantStatusFromDecision } from "@/lib/applicants";
import type { ImportedApplicantPayload } from "@/lib/google-form-import";
import { screenImportedApplicant } from "@/lib/google-form-import";
import { applicantLooksDuplicate, type DuplicateApplicantCandidate } from "@/lib/applicant-import-utils";
import { recalculateApplicant } from "@/lib/applicant-recalculation";

export type ImportedApplicantUpsertOutcome = {
  applicantId: string;
  action: "created" | "updated";
};

export async function upsertImportedApplicant(args: {
  propertyId: string | null;
  row: ImportedApplicantPayload;
  rentMonthly: number | null;
  passMultiplier: number;
  guarantorMinMultiplier: number;
  importSource: "GOOGLE_FORM" | "GOOGLE_FORM_AUTO";
  existingApplicants: DuplicateApplicantCandidate[];
}) : Promise<ImportedApplicantUpsertOutcome> {
  const {
    propertyId,
    row,
    rentMonthly,
    passMultiplier,
    guarantorMinMultiplier,
    importSource,
    existingApplicants,
  } = args;

  const existing = applicantLooksDuplicate(existingApplicants, row);
  const screening = screenImportedApplicant(row, rentMonthly, {
    passMultiplier,
    guarantorMinMultiplier,
  });

  if (existing?.id) {
    await prisma.applicant.update({
      where: { id: existing.id },
      data: {
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        propertyId,
        employmentStatus: row.employmentStatus,
        monthlyIncome: row.monthlyIncome,
        requestedMoveIn: row.requestedMoveIn,
        adults: row.adults ?? undefined,
        children: row.children ?? undefined,
        hasPets: row.hasPets ?? undefined,
        petDetails: row.petDetails,
        notes: row.notes,
        importExternalKey: row.externalKey,
        importRawPayload: row.rawPayload,
        importSource,
        importSubmittedAt: row.submittedAt,
        screeningStatus: screening.screeningStatus,
        screeningSummary: screening.screeningSummary,
        screeningReason: screening.screeningReason,
        screeningScore: screening.score,
        canProvideGuarantor: row.canProvideGuarantor,
        referencing: {
          upsert: {
            create: {
              creditCheckPassed: screening.creditCheckPassed,
              guarantorRequired: screening.guarantorRequired,
              guarantorProvided: row.canProvideGuarantor === true,
              petInsuranceProvided: row.petInsurance ?? false,
              landlordReference: row.landlordReferenceAvailable ?? false,
              score: screening.score,
              decision: screening.decision,
              risks: screening.reasons.join("\n"),
            },
            update: {
              guarantorRequired: screening.guarantorRequired,
              guarantorProvided: row.canProvideGuarantor === true,
              petInsuranceProvided: row.petInsurance ?? false,
              landlordReference: row.landlordReferenceAvailable ?? false,
              score: screening.score,
              decision: screening.decision,
              risks: screening.reasons.join("\n"),
            },
          },
        },
      },
    });

    await recalculateApplicant(existing.id);

    const existingIndex = existingApplicants.findIndex((candidate) => candidate.id === existing.id);
    if (existingIndex >= 0) {
      existingApplicants[existingIndex] = {
        id: existing.id,
        importExternalKey: row.externalKey,
        email: row.email ?? null,
        phone: row.phone ?? null,
        fullName: row.fullName,
        importSubmittedAt: row.submittedAt ? new Date(row.submittedAt) : null,
      };
    }

    return { applicantId: existing.id, action: "updated" };
  }

  const status = getApplicantStatusFromDecision({
    decision: screening.decision,
    currentStatus: "APPLIED",
  });

  const applicant = await prisma.applicant.create({
    data: {
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      propertyId,
      employmentStatus: row.employmentStatus,
      monthlyIncome: row.monthlyIncome,
      requestedMoveIn: row.requestedMoveIn,
      adults: row.adults ?? undefined,
      children: row.children ?? undefined,
      hasPets: row.hasPets ?? undefined,
      petDetails: row.petDetails,
      notes: row.notes,
      status,
      importExternalKey: row.externalKey,
      importRawPayload: row.rawPayload,
      importSource,
      importSubmittedAt: row.submittedAt,
      screeningStatus: screening.screeningStatus,
      screeningSummary: screening.screeningSummary,
      screeningReason: screening.screeningReason,
      screeningScore: screening.score,
      canProvideGuarantor: row.canProvideGuarantor,
      referencing: {
        create: {
          creditCheckPassed: screening.creditCheckPassed,
          guarantorRequired: screening.guarantorRequired,
          guarantorProvided: row.canProvideGuarantor === true,
          petInsuranceProvided: row.petInsurance ?? false,
          landlordReference: row.landlordReferenceAvailable ?? false,
          score: screening.score,
          decision: screening.decision,
          risks: screening.reasons.join("\n"),
        },
      },
    },
  });

  existingApplicants.push({
    id: applicant.id,
    importExternalKey: row.externalKey,
    email: row.email ?? null,
    phone: row.phone ?? null,
    fullName: row.fullName,
    importSubmittedAt: row.submittedAt ? new Date(row.submittedAt) : null,
  });

  return { applicantId: applicant.id, action: "created" };
}

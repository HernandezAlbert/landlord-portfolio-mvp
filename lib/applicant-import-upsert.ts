import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApplicantStatusFromDecision } from "@/lib/applicants";
import type { ImportedApplicantPayload } from "@/lib/google-form-import";
import { screenImportedApplicant } from "@/lib/google-form-import";
import {
  applicantLooksDuplicate,
  type DuplicateApplicantCandidate,
} from "@/lib/applicant-import-utils";
import { recalculateApplicant } from "@/lib/applicant-recalculation";

export type ImportedApplicantUpsertOutcome = {
  applicantId: string;
  action: "created" | "updated";
};

type UpsertArgs = {
  propertyId: string | null;
  row: ImportedApplicantPayload;
  rentMonthly: number | null;
  passMultiplier: number;
  guarantorMinMultiplier: number;
  importSource: "GOOGLE_FORM" | "GOOGLE_FORM_AUTO";
  existingApplicants: DuplicateApplicantCandidate[];
};

function toSubmittedDate(value?: Date | string | null) {
  return value ? new Date(value) : null;
}

function buildApplicantUpdateData(args: {
  propertyId: string | null;
  row: ImportedApplicantPayload;
  screening: ReturnType<typeof screenImportedApplicant>;
  importSource: "GOOGLE_FORM" | "GOOGLE_FORM_AUTO";
}) {
  const { propertyId, row, screening, importSource } = args;

  return {
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    property: propertyId
      ? { connect: { id: propertyId } }
      : { disconnect: true },
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
  } satisfies Prisma.ApplicantUpdateInput;
}

async function updateExistingApplicant(args: {
  applicantId: string;
  propertyId: string | null;
  row: ImportedApplicantPayload;
  screening: ReturnType<typeof screenImportedApplicant>;
  importSource: "GOOGLE_FORM" | "GOOGLE_FORM_AUTO";
  existingApplicants: DuplicateApplicantCandidate[];
}) {
  const {
    applicantId,
    propertyId,
    row,
    screening,
    importSource,
    existingApplicants,
  } = args;

  await prisma.applicant.update({
    where: { id: applicantId },
    data: buildApplicantUpdateData({
      propertyId,
      row,
      screening,
      importSource,
    }),
  });

  await recalculateApplicant(applicantId);

  const idx = existingApplicants.findIndex(
    (candidate) => candidate.id === applicantId,
  );

  const nextCandidate: DuplicateApplicantCandidate = {
    id: applicantId,
    importExternalKey: row.externalKey,
    email: row.email ?? null,
    phone: row.phone ?? null,
    fullName: row.fullName,
    importSubmittedAt: toSubmittedDate(row.submittedAt),
  };

  if (idx >= 0) {
    existingApplicants[idx] = nextCandidate;
  } else {
    existingApplicants.push(nextCandidate);
  }

  return { applicantId, action: "updated" as const };
}

function isUniqueImportExternalKeyError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray((error.meta as { target?: unknown } | undefined)?.target) &&
    ((error.meta as { target?: unknown[] }).target ?? []).includes(
      "importExternalKey",
    )
  );
}

export async function upsertImportedApplicant(
  args: UpsertArgs,
): Promise<ImportedApplicantUpsertOutcome> {
  const {
    propertyId,
    row,
    rentMonthly,
    passMultiplier,
    guarantorMinMultiplier,
    importSource,
    existingApplicants,
  } = args;

  const screening = screenImportedApplicant(row, rentMonthly, {
    passMultiplier,
    guarantorMinMultiplier,
  });

  if (row.externalKey) {
    const existingByKey = await prisma.applicant.findUnique({
      where: { importExternalKey: row.externalKey },
      select: { id: true },
    });

    if (existingByKey?.id) {
      return updateExistingApplicant({
        applicantId: existingByKey.id,
        propertyId,
        row,
        screening,
        importSource,
        existingApplicants,
      });
    }
  }

  const existing = applicantLooksDuplicate(existingApplicants, row);

  if (existing?.id) {
    return updateExistingApplicant({
      applicantId: existing.id,
      propertyId,
      row,
      screening,
      importSource,
      existingApplicants,
    });
  }

  const status = getApplicantStatusFromDecision({
    decision: screening.decision,
    currentStatus: "APPLIED",
  });

  try {
    const applicant = await prisma.applicant.create({
      data: {
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        property: propertyId
          ? { connect: { id: propertyId } }
          : undefined,
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
      importSubmittedAt: toSubmittedDate(row.submittedAt),
    });

    return { applicantId: applicant.id, action: "created" };
  } catch (error) {
    if (isUniqueImportExternalKeyError(error) && row.externalKey) {
      const existingAfterConflict = await prisma.applicant.findUnique({
        where: { importExternalKey: row.externalKey },
        select: { id: true },
      });

      if (existingAfterConflict?.id) {
        return updateExistingApplicant({
          applicantId: existingAfterConflict.id,
          propertyId,
          row,
          screening,
          importSource,
          existingApplicants,
        });
      }
    }

    throw error;
  }
}
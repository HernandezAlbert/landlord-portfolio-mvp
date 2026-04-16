import { prisma } from "./prisma";
import { computeReferencingScore } from "./referencing";
import {
  decisionToApplicantStatus,
  getEffectiveDecision,
  isStickyManualApplicantStatus,
} from "./applicants";
import {
  getIncomeBreakdownFromRawPayload,
  screenImportedApplicant,
} from "./google-form-import";

type LoadedApplicant = Awaited<ReturnType<typeof loadApplicantForRecalculation>>;

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, entryValue]) => [key, entryValue == null ? "" : String(entryValue)]
  );

  return Object.fromEntries(entries);
}

async function getRentForApplicant(applicant: {
  propertyId: string | null;
  property?: { advertisedRentMonthly?: number | null } | null;
}) {
  if (applicant.property?.advertisedRentMonthly) {
    return applicant.property.advertisedRentMonthly;
  }

  if (!applicant.propertyId) return null;

  const activeTenancy = await prisma.tenancy.findFirst({
    where: {
      propertyId: applicant.propertyId,
      isActive: true,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  return activeTenancy?.rentMonthly ?? null;
}

async function loadApplicantForRecalculation(applicantId: string, userId?: string) {
  return prisma.applicant.findFirst({
    where: {
      id: applicantId,
      deletedAt: null,
      ...(userId ? { userId } : {}),
    },
    include: {
      property: true,
      referencing: true,
    },
  });
}

async function recalculateLoadedApplicant(applicant: NonNullable<LoadedApplicant>) {
  const rentMonthly = await getRentForApplicant(applicant);

  const referencing = computeReferencingScore({
    monthlyIncome:
      getIncomeBreakdownFromRawPayload(applicant.importRawPayload).totalMonthlyPence ??
      applicant.monthlyIncome,
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
    guarantorProvided:
      applicant.referencing?.guarantorProvided ?? applicant.canProvideGuarantor ?? false,
    petInsuranceProvided: applicant.referencing?.petInsuranceProvided,
    hasPets: applicant.hasPets,
    savingsBufferMonths: applicant.savingsBufferMonths,
  });

  const effectiveDecision = getEffectiveDecision({
    computedDecision: referencing.decision,
    manualDecision: applicant.referencing?.manualDecision ?? null,
  });

  const status = isStickyManualApplicantStatus(applicant.status)
    ? applicant.status
    : decisionToApplicantStatus(effectiveDecision);

  let screeningData: {
    screeningScore?: number | null;
    screeningStatus?: string | null;
    screeningSummary?: string | null;
    screeningReason?: string | null;
  } = {
    screeningScore: referencing.score,
  };

  if (
    applicant.importSource === "GOOGLE_FORM" ||
    applicant.importSource === "GOOGLE_FORM_AUTO"
  ) {
    const screening = screenImportedApplicant(
      {
        externalKey: applicant.importExternalKey ?? applicant.id,
        submittedAt: applicant.importSubmittedAt ?? null,
        fullName: applicant.fullName,
        email: applicant.email ?? null,
        phone: applicant.phone ?? null,
        employmentStatus: applicant.employmentStatus ?? null,
        monthlyIncome:
          getIncomeBreakdownFromRawPayload(applicant.importRawPayload).totalMonthlyPence ??
          applicant.monthlyIncome ??
          null,
        requestedMoveIn: applicant.requestedMoveIn ?? null,
        adults: applicant.adults,
        children: applicant.children,
        hasPets: applicant.hasPets,
        petDetails: applicant.petDetails ?? null,
        notes: applicant.notes ?? null,
        rawPayload: toStringRecord(applicant.importRawPayload),
        adverseCredit:
          applicant.referencing?.creditCheckPassed === null ||
          applicant.referencing?.creditCheckPassed === undefined
            ? null
            : !applicant.referencing.creditCheckPassed,
        petInsurance: applicant.referencing?.petInsuranceProvided ?? null,
        landlordReferenceAvailable: applicant.referencing?.landlordReference ?? null,
        canProvideGuarantor:
          applicant.referencing?.guarantorProvided ?? applicant.canProvideGuarantor ?? null,
      },
      rentMonthly,
      {
        passMultiplier: applicant.property?.screeningPassMultiplier ?? 3,
        guarantorMinMultiplier:
          applicant.property?.screeningGuarantorMinMultiplier ?? 2.0,
      }
    );

    screeningData = {
      screeningScore: screening.score,
      screeningStatus: screening.screeningStatus,
      screeningSummary: screening.screeningSummary,
      screeningReason: screening.screeningReason,
    };
  }

  await prisma.referencingCheck.upsert({
    where: { applicantId: applicant.id },
    create: {
      applicantId: applicant.id,
      idProvided: applicant.referencing?.idProvided ?? false,
      rightToRentChecked: applicant.referencing?.rightToRentChecked ?? false,
      payslipsProvided: applicant.referencing?.payslipsProvided ?? false,
      bankStatementsProvided: applicant.referencing?.bankStatementsProvided ?? false,
      employmentReference: applicant.referencing?.employmentReference ?? false,
      landlordReference: applicant.referencing?.landlordReference ?? false,
      creditCheckPassed: applicant.referencing?.creditCheckPassed ?? null,
      incomeVerified: applicant.referencing?.incomeVerified ?? false,
      guarantorRequired: applicant.referencing?.guarantorRequired ?? false,
      guarantorProvided:
        applicant.referencing?.guarantorProvided ??
        applicant.canProvideGuarantor ??
        false,
      petInsuranceProvided: applicant.referencing?.petInsuranceProvided ?? false,
      score: referencing.score,
      decision: referencing.decision,
      manualDecision: applicant.referencing?.manualDecision ?? null,
      manualDecisionReason: applicant.referencing?.manualDecisionReason ?? null,
      risks: referencing.risks.join("\n") || null,
    },
    update: {
      score: referencing.score,
      decision: referencing.decision,
      risks: referencing.risks.join("\n") || null,
    },
  });

  await prisma.applicant.update({
    where: { id: applicant.id },
    data: {
      status,
      monthlyIncome:
        getIncomeBreakdownFromRawPayload(applicant.importRawPayload).totalMonthlyPence ??
        applicant.monthlyIncome,
      ...screeningData,
    },
  });

  return {
    applicantId: applicant.id,
    fullName: applicant.fullName,
    status,
    effectiveDecision,
    referencing,
    screeningData,
  };
}

export async function recalculateApplicant(applicantId: string) {
  const applicant = await loadApplicantForRecalculation(applicantId);

  if (!applicant) {
    throw new Error("Applicant not found");
  }

  return recalculateLoadedApplicant(applicant);
}

export async function recalculateApplicantForUser(userId: string, applicantId: string) {
  const applicant = await loadApplicantForRecalculation(applicantId, userId);

  if (!applicant) {
    throw new Error("Applicant not found");
  }

  return recalculateLoadedApplicant(applicant);
}

export async function recalculateAllApplicants() {
  const applicants = await prisma.applicant.findMany({
    where: { deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const results = [];

  for (const applicant of applicants) {
    results.push(await recalculateApplicant(applicant.id));
  }

  return results;
}

export async function recalculateAllApplicantsForUser(userId: string) {
  const applicants = await prisma.applicant.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const results = [];

  for (const applicant of applicants) {
    results.push(await recalculateApplicantForUser(userId, applicant.id));
  }

  return results;
}
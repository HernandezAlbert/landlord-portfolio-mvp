import { prisma } from "@/lib/prisma";
import { computeReferencingScore } from "@/lib/referencing";
import { decisionToApplicantStatus, getEffectiveDecision, isStickyManualApplicantStatus } from "@/lib/applicants";
import { getUploadedApplicantDocs, type UploadedApplicantDoc } from "@/lib/applicant-documents";
import { getIncomeBreakdownFromRawPayload } from "@/lib/google-form-import";

const DOC_TYPE_FIELD_MAP = {
  ID: "idProvided",
  RIGHT_TO_RENT: "rightToRentChecked",
  PAYSLIP: "payslipsProvided",
  BANK_STATEMENT: "bankStatementsProvided",
  EMPLOYER_REFERENCE: "employmentReference",
  LANDLORD_REFERENCE: "landlordReference",
  PET_INSURANCE: "petInsuranceProvided",
  GUARANTOR: "guarantorProvided",
} as const;

type ReferencingBooleanField = (typeof DOC_TYPE_FIELD_MAP)[keyof typeof DOC_TYPE_FIELD_MAP];

type ReferencingDocBooleans = Partial<Record<ReferencingBooleanField, boolean>>;

function deriveCheckFlagsFromDocs(uploadedDocs: UploadedApplicantDoc[]): ReferencingDocBooleans {
  const flags: ReferencingDocBooleans = {};
  for (const doc of uploadedDocs) {
    const field = DOC_TYPE_FIELD_MAP[doc.docType as keyof typeof DOC_TYPE_FIELD_MAP];
    if (field) flags[field] = true;
  }
  return flags;
}

export async function syncApplicantReferencingFromDocs(applicantId: string) {
  const applicant = await prisma.applicant.findUnique({
    where: { id: applicantId },
    include: { referencing: true, property: true },
  });

  if (!applicant || applicant.deletedAt) return;

  const uploadedDocs = await getUploadedApplicantDocs(applicantId);
  const docFlags = deriveCheckFlagsFromDocs(uploadedDocs);

  const activeTenancy = applicant.propertyId
    ? await prisma.tenancy.findFirst({
        where: { propertyId: applicant.propertyId, isActive: true, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const result = computeReferencingScore({
    monthlyIncome: getIncomeBreakdownFromRawPayload(applicant.importRawPayload).totalMonthlyPence ?? applicant.monthlyIncome,
    rentMonthly: applicant.property?.advertisedRentMonthly ?? activeTenancy?.rentMonthly ?? null,
    employmentStatus: applicant.employmentStatus,
    idProvided: docFlags.idProvided ?? applicant.referencing?.idProvided,
    rightToRentChecked: docFlags.rightToRentChecked ?? applicant.referencing?.rightToRentChecked,
    payslipsProvided: docFlags.payslipsProvided ?? applicant.referencing?.payslipsProvided,
    bankStatementsProvided: docFlags.bankStatementsProvided ?? applicant.referencing?.bankStatementsProvided,
    employmentReference: docFlags.employmentReference ?? applicant.referencing?.employmentReference,
    landlordReference: docFlags.landlordReference ?? applicant.referencing?.landlordReference,
    incomeVerified: applicant.referencing?.incomeVerified,
    creditCheckPassed: applicant.referencing?.creditCheckPassed,
    guarantorRequired: applicant.referencing?.guarantorRequired,
    guarantorProvided: docFlags.guarantorProvided ?? applicant.referencing?.guarantorProvided,
    petInsuranceProvided: docFlags.petInsuranceProvided ?? applicant.referencing?.petInsuranceProvided,
    hasPets: applicant.hasPets,
    savingsBufferMonths: applicant.savingsBufferMonths,
  });

  const nextData = {
    idProvided: docFlags.idProvided ?? applicant.referencing?.idProvided ?? false,
    rightToRentChecked: docFlags.rightToRentChecked ?? applicant.referencing?.rightToRentChecked ?? false,
    payslipsProvided: docFlags.payslipsProvided ?? applicant.referencing?.payslipsProvided ?? false,
    bankStatementsProvided: docFlags.bankStatementsProvided ?? applicant.referencing?.bankStatementsProvided ?? false,
    employmentReference: docFlags.employmentReference ?? applicant.referencing?.employmentReference ?? false,
    landlordReference: docFlags.landlordReference ?? applicant.referencing?.landlordReference ?? false,
    guarantorProvided: docFlags.guarantorProvided ?? applicant.referencing?.guarantorProvided ?? false,
    petInsuranceProvided: docFlags.petInsuranceProvided ?? applicant.referencing?.petInsuranceProvided ?? false,
    incomeVerified: applicant.referencing?.incomeVerified ?? false,
    creditCheckPassed: applicant.referencing?.creditCheckPassed ?? null,
    guarantorRequired: applicant.referencing?.guarantorRequired ?? false,
    score: result.score,
    decision: result.decision,
    manualDecision: applicant.referencing?.manualDecision ?? null,
    manualDecisionReason: applicant.referencing?.manualDecisionReason ?? null,
    risks: Array.from(new Set([
      ...((applicant.referencing?.risks ?? "").split("\n").map((s) => s.trim()).filter(Boolean)),
      ...result.risks,
    ])).join("\n") || null,
  };

  await prisma.referencingCheck.upsert({
    where: { applicantId },
    create: {
      applicantId,
      ...nextData,
    },
    update: nextData,
  });

  const effectiveDecision = getEffectiveDecision({
    computedDecision: result.decision,
    manualDecision: applicant.referencing?.manualDecision ?? null,
  });

  const nextStatus = isStickyManualApplicantStatus(applicant.status)
    ? applicant.status
    : decisionToApplicantStatus(effectiveDecision);

  if (applicant.status !== nextStatus) {
    await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: nextStatus },
    });
  }
}

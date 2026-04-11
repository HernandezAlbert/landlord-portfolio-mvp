export type ApplicantDecision =
  | "ACCEPT"
  | "ACCEPT_WITH_GUARANTOR"
  | "REVIEW"
  | "DECLINE";

export type ApplicantStatus =
  | "APPLIED"
  | "REFERENCING"
  | "APPROVED"
  | "DECLINED"
  | "REJECTED"
  | "MORE_INFO_REQUESTED"
  | "WITHDRAWN";

export type ScreeningStatus =
  | "ACCEPT"
  | "ACCEPT_WITH_GUARANTOR"
  | "REVIEW"
  | "DECLINE"
  | "INSUFFICIENT_DATA"
  | "BLUE";

export function formatMoney(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) / 100);
}

export function decisionToApplicantStatus(
  decision: ApplicantDecision,
): ApplicantStatus {
  switch (decision) {
    case "ACCEPT":
      return "APPROVED";
    case "ACCEPT_WITH_GUARANTOR":
    case "REVIEW":
      return "REFERENCING";
    case "DECLINE":
      return "DECLINED";
    default:
      return "APPLIED";
  }
}

function normalizeDecision(value?: string | null): ApplicantDecision | null {
  if (
    value === "ACCEPT" ||
    value === "ACCEPT_WITH_GUARANTOR" ||
    value === "REVIEW" ||
    value === "DECLINE"
  ) {
    return value;
  }

  return null;
}

export function normalizeApplicantStatus(value?: string | null): ApplicantStatus | null {
  if (
    value === "APPLIED" ||
    value === "REFERENCING" ||
    value === "APPROVED" ||
    value === "DECLINED" ||
    value === "REJECTED" ||
    value === "MORE_INFO_REQUESTED" ||
    value === "WITHDRAWN"
  ) {
    return value;
  }

  return null;
}

export function formatApplicantStatus(status?: string | null) {
  switch (normalizeApplicantStatus(status)) {
    case "APPLIED":
      return "Applied";
    case "REFERENCING":
      return "Referencing";
    case "APPROVED":
      return "Approved";
    case "DECLINED":
      return "Declined";
    case "REJECTED":
      return "Applicant rejected";
    case "MORE_INFO_REQUESTED":
      return "Requested more info / guarantor";
    case "WITHDRAWN":
      return "Withdrawn";
    default:
      return status ?? "—";
  }
}

export function isStickyManualApplicantStatus(status?: string | null) {
  return (
    status === "WITHDRAWN" ||
    status === "REJECTED" ||
    status === "MORE_INFO_REQUESTED"
  );
}

export function getApplicantStatusFromDecision(input: {
  decision: string | null | undefined;
  currentStatus?: string | null;
}): ApplicantStatus {
  if (isStickyManualApplicantStatus(input.currentStatus)) {
    return input.currentStatus as ApplicantStatus;
  }

  const normalized = normalizeDecision(input.decision) ?? "REVIEW";
  return decisionToApplicantStatus(normalized);
}

export function getEffectiveDecision(input: {
  computedDecision: ApplicantDecision;
  manualDecision?: string | null;
}): ApplicantDecision {
  return normalizeDecision(input.manualDecision) ?? input.computedDecision;
}

export function getApplicantStatusTone(status?: string | null) {
  switch (status) {
    case "APPROVED":
    case "ACCEPT":
      return "border-green-200 bg-green-50 text-green-700";
    case "REFERENCING":
    case "APPLIED":
    case "NEW":
    case "SCREENING":
    case "REVIEW":
    case "ACCEPT_WITH_GUARANTOR":
    case "MORE_INFO_REQUESTED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "DECLINED":
    case "DECLINE":
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";
    case "WITHDRAWN":
      return "border-slate-200 bg-slate-50 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function getDecisionTone(decision?: string | null) {
  switch (decision) {
    case "ACCEPT":
      return "border-green-200 bg-green-50 text-green-700";
    case "ACCEPT_WITH_GUARANTOR":
    case "REVIEW":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "DECLINE":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function normalizeScreeningStatus(
  status?: string | null,
): Exclude<ScreeningStatus, "BLUE"> {
  if (!status) return "INSUFFICIENT_DATA";
  if (status === "BLUE") return "INSUFFICIENT_DATA";

  if (
    status === "ACCEPT" ||
    status === "ACCEPT_WITH_GUARANTOR" ||
    status === "REVIEW" ||
    status === "DECLINE" ||
    status === "INSUFFICIENT_DATA"
  ) {
    return status;
  }

  return "INSUFFICIENT_DATA";
}

export function getScreeningTone(status?: string | null) {
  switch (normalizeScreeningStatus(status)) {
    case "ACCEPT":
      return "border-green-200 bg-green-50 text-green-700";
    case "ACCEPT_WITH_GUARANTOR":
    case "REVIEW":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "DECLINE":
      return "border-red-200 bg-red-50 text-red-700";
    case "INSUFFICIENT_DATA":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function getScreeningLabel(status?: string | null) {
  switch (normalizeScreeningStatus(status)) {
    case "ACCEPT":
      return "Pass";
    case "ACCEPT_WITH_GUARANTOR":
      return "Guarantor required";
    case "REVIEW":
      return "Review";
    case "DECLINE":
      return "Fail";
    case "INSUFFICIENT_DATA":
    default:
      return "Insufficient data";
  }
}

export function formatScreeningStatus(status?: string | null) {
  return getScreeningLabel(status);
}

export function referencingCompletionPercentage(
  checks?:
    | {
        idProvided?: boolean | null;
        rightToRentChecked?: boolean | null;
        payslipsProvided?: boolean | null;
        bankStatementsProvided?: boolean | null;
        employmentReference?: boolean | null;
        landlordReference?: boolean | null;
        incomeVerified?: boolean | null;
        creditCheckPassed?: boolean | null;
        guarantorProvided?: boolean | null;
        petInsuranceProvided?: boolean | null;
      }
    | null,
) {
  if (!checks) {
    return {
      percent: 0,
      completed: 0,
      total: 0,
      missing: 0,
    };
  }

  const relevantChecks = [
    checks.idProvided,
    checks.rightToRentChecked,
    checks.payslipsProvided,
    checks.bankStatementsProvided,
    checks.employmentReference,
    checks.landlordReference,
    checks.incomeVerified,
    checks.creditCheckPassed === true,
  ];

  const total = relevantChecks.length;
  const completed = relevantChecks.filter(Boolean).length;
  const missing = total - completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    percent,
    completed,
    total,
    missing,
  };
}
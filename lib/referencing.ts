import type { ApplicantDecision } from "./applicants";

export type ReferencingInput = {
  monthlyIncome?: number | null;
  rentMonthly?: number | null;
  employmentStatus?: string | null;
  idProvided?: boolean | null;
  rightToRentChecked?: boolean | null;
  payslipsProvided?: boolean | null;
  bankStatementsProvided?: boolean | null;
  employmentReference?: boolean | null;
  landlordReference?: boolean | null;
  incomeVerified?: boolean | null;
  creditCheckPassed?: boolean | null;
  guarantorRequired?: boolean | null;
  guarantorProvided?: boolean | null;
  petInsuranceProvided?: boolean | null;
  hasPets?: boolean | null;
  savingsBufferMonths?: number | null;
};

export type ReferencingResult = {
  score: number;
  decision: ApplicantDecision;
  risks: string[];
  reasons: string[];
  affordabilityRatio: number | null;
  incomeUsed: number | null;
  rentUsed: number | null;
  thresholds: {
    minimum: number;
    preferred: number;
  };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function computeReferencingScore(
  input: ReferencingInput,
): ReferencingResult {
  const minimum = 2.5;
  const preferred = 3.0;

  const income = toNumber(input.monthlyIncome);
  const rent = toNumber(input.rentMonthly);
  const affordabilityRatio =
    income && rent && rent > 0 ? Number((income / rent).toFixed(2)) : null;

  let score = 0;
  const risks: string[] = [];
  const reasons: string[] = [];

  if (rent === null || rent <= 0) {
    risks.push("No advertised or active rent found for this property.");
    reasons.push(
      "No advertised or active rent was found, so affordability could not be checked.",
    );
  }

  if (income === null || income <= 0) {
    risks.push("No monthly income provided.");
    reasons.push("No income provided.");
  }

  if (affordabilityRatio !== null) {
    if (affordabilityRatio >= preferred) {
      score += 25;
      reasons.push(
        `Strong affordability at ${affordabilityRatio.toFixed(2)}x rent.`,
      );
    } else if (affordabilityRatio >= minimum) {
      score += 15;
      risks.push("Affordability is below the preferred level.");
      reasons.push(
        `Borderline affordability at ${affordabilityRatio.toFixed(2)}x rent.`,
      );
    } else if (affordabilityRatio >= 2.0) {
      score += 5;
      risks.push("Affordability is below the minimum threshold.");
      reasons.push(
        `Affordability below the minimum threshold at ${affordabilityRatio.toFixed(2)}x rent.`,
      );
    } else {
      risks.push("Very weak affordability.");
      reasons.push(
        `Very weak affordability at ${affordabilityRatio.toFixed(2)}x rent.`,
      );
    }
  }

  const employmentStatus = (input.employmentStatus ?? "").trim().toLowerCase();
  if (employmentStatus === "full_time" || employmentStatus === "employed") {
    score += 15;
    reasons.push("Employment status supports affordability.");
  } else if (employmentStatus) {
    score += 5;
    reasons.push("Employment status recorded.");
  } else {
    risks.push("Employment status not provided.");
    reasons.push("No employment details provided.");
  }

  if (input.idProvided) {
    score += 5;
    reasons.push("ID provided.");
  } else {
    risks.push("ID not provided.");
  }

  if (input.rightToRentChecked) {
    score += 5;
    reasons.push("Right to Rent completed.");
  } else {
    risks.push("Right to Rent not completed.");
  }

  if (input.payslipsProvided) {
    score += 5;
    reasons.push("Payslips provided.");
  }

  if (input.bankStatementsProvided) {
    score += 5;
    reasons.push("Bank statements provided.");
  }

  if (input.incomeVerified) {
    score += 10;
    reasons.push("Income verified.");
  }

  if (input.employmentReference) {
    score += 10;
    reasons.push("Employer reference received.");
  }

  if (input.creditCheckPassed === true) {
    score += 20;
    reasons.push("Credit check passed.");
  } else if (input.creditCheckPassed === false) {
    risks.push("Credit check failed.");
    reasons.push("Credit check failed.");
  } else {
    risks.push("Credit check not completed.");
  }

  if (input.landlordReference) {
    score += 10;
    reasons.push("Landlord reference received.");
  }

  const savingsBufferMonths = toNumber(input.savingsBufferMonths) ?? 0;
  if (savingsBufferMonths >= 6) {
    score += 10;
    reasons.push("Strong savings buffer.");
  } else if (savingsBufferMonths >= 3) {
    score += 5;
    reasons.push("Moderate savings buffer.");
  }

  if (input.hasPets) {
    if (input.petInsuranceProvided) {
      score += 5;
      reasons.push("Pet insurance provided.");
    } else {
      risks.push("Pets declared without pet insurance evidence.");
      reasons.push("Pets declared.");
    }
  } else {
    score += 5;
    reasons.push("No pets declared.");
  }

  if (input.guarantorRequired) {
    if (input.guarantorProvided) {
      score += 10;
      reasons.push("Guarantor available.");
    } else {
      risks.push("Guarantor required but not provided.");
      reasons.push("Guarantor required.");
    }
  } else if (input.guarantorProvided) {
    score += 5;
    reasons.push("Guarantor available.");
  }

  score = clamp(score, 0, 100);

  let decision: ApplicantDecision = "REVIEW";

  if (input.creditCheckPassed === false) {
    decision = "DECLINE";
  } else if (affordabilityRatio !== null && affordabilityRatio < 2.0) {
    decision = "DECLINE";
  } else if (
    rent === null ||
    rent <= 0 ||
    income === null ||
    income <= 0 ||
    !input.idProvided ||
    !input.rightToRentChecked
  ) {
    decision = "REVIEW";
  } else if (affordabilityRatio !== null && affordabilityRatio >= preferred) {
    decision = score >= 75 ? "ACCEPT" : "REVIEW";
  } else if (
    affordabilityRatio !== null &&
    affordabilityRatio >= minimum &&
    (input.guarantorProvided || score >= 65)
  ) {
    decision = "ACCEPT_WITH_GUARANTOR";
  } else {
    decision = "DECLINE";
  }

  return {
    score,
    decision,
    risks,
    reasons,
    affordabilityRatio,
    incomeUsed: income,
    rentUsed: rent,
    thresholds: {
      minimum,
      preferred,
    },
  };
}
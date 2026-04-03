export type GuarantorAssessmentResult = {
  status: "PENDING" | "PASSED" | "CONDITIONAL" | "FAILED";
  score: number;
  summary: string;
};

export function assessGuarantor({
  rentPence,
  annualIncomePence,
}: {
  rentPence: number;
  annualIncomePence?: number | null;
}): GuarantorAssessmentResult {
  if (!annualIncomePence || rentPence <= 0) {
    return {
      status: "PENDING",
      score: 0,
      summary: "Insufficient data",
    };
  }

  const monthlyIncome = annualIncomePence / 12;
  const ratio = monthlyIncome / rentPence;

  if (ratio >= 3) {
    return {
      status: "PASSED",
      score: 100,
      summary: "Strong guarantor",
    };
  }

  if (ratio >= 2.5) {
    return {
      status: "CONDITIONAL",
      score: 70,
      summary: "Acceptable with caution",
    };
  }

  return {
    status: "FAILED",
    score: 30,
    summary: "Income too low",
  };
}
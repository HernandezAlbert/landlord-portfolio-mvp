export function getDecisionWithGuarantor(args: {
  currentDecision: string;
  guarantorRequired?: boolean | null;
  guarantorOutcome?: string | null;
}): string {
  const { currentDecision, guarantorRequired, guarantorOutcome } = args;

  if (!guarantorRequired) return currentDecision;

  if (guarantorOutcome === "PASSED" || guarantorOutcome === "CONDITIONAL") {
    return currentDecision;
  }

  if (guarantorOutcome === "FAILED") {
    return "REJECT";
  }

  return "REVIEW";
}
export type HoldingDepositStatus =
  | "PENDING"
  | "RECEIVED"
  | "REFUNDED"
  | "RETAINED"
  | "APPLIED"
  | "EXPIRED"
  | "CANCELLED";

export type HoldingDepositAppliedTo = "FIRST_RENT" | "TENANCY_DEPOSIT";

export function calculateWeeklyRentFromMonthlyPence(monthlyRentPence?: number | null) {
  if (!monthlyRentPence || monthlyRentPence <= 0) return 0;
  return Math.round((monthlyRentPence * 12) / 52);
}

export function defaultHoldingDepositDeadline(receivedAt: Date) {
  const deadline = new Date(receivedAt);
  deadline.setDate(deadline.getDate() + 15);
  return deadline;
}

export function isActiveHoldingDepositStatus(status?: string | null) {
  return status === "PENDING" || status === "RECEIVED";
}

export function formatHoldingDepositStatus(status?: string | null) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "RECEIVED":
      return "Received";
    case "REFUNDED":
      return "Refunded";
    case "RETAINED":
      return "Retained";
    case "APPLIED":
      return "Applied";
    case "EXPIRED":
      return "Expired";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status ?? "—";
  }
}

export function formatAppliedTo(value?: string | null) {
  switch (value) {
    case "FIRST_RENT":
      return "First rent";
    case "TENANCY_DEPOSIT":
      return "Tenancy deposit";
    default:
      return "—";
  }
}

export function validateHoldingDepositAmount(params: {
  requestedPence: number;
  weeklyRentPence: number;
}) {
  const { requestedPence, weeklyRentPence } = params;

  if (requestedPence <= 0) {
    return "Holding deposit must be greater than £0.";
  }

  if (weeklyRentPence <= 0) {
    return "Cannot create a holding deposit until the property rent is set.";
  }

  if (requestedPence > weeklyRentPence) {
    return "Holding deposit cannot exceed one week's rent.";
  }

  return null;
}
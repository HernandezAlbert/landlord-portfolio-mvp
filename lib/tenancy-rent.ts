import { formatGBPFromPence } from "./money";

export type RentFrequency = "WEEKLY" | "MONTHLY";

export type TenancyRentLike = {
  rentAmount?: number | null;
  rentFrequency?: RentFrequency | null;
  rentMonthly?: number | null;
};

export function getRentFrequency(tenancy: TenancyRentLike): RentFrequency {
  return tenancy.rentFrequency === "WEEKLY" ? "WEEKLY" : "MONTHLY";
}

export function getRentAmountPence(tenancy: TenancyRentLike): number {
  const directAmount = Number(tenancy.rentAmount ?? 0);
  if (directAmount > 0) return directAmount;

  return Number(tenancy.rentMonthly ?? 0);
}

export function getMonthlyEquivalentPence(tenancy: TenancyRentLike): number {
  const amount = getRentAmountPence(tenancy);
  const frequency = getRentFrequency(tenancy);

  if (frequency === "WEEKLY") {
    return Math.round((amount * 52) / 12);
  }

  return amount;
}

export function getRentLabel(tenancy: TenancyRentLike): string {
  return getRentFrequency(tenancy) === "WEEKLY" ? "Weekly rent" : "Monthly rent";
}

export function formatMoney(pence: number): string {
  return formatGBPFromPence(pence);
}

export function formatRentWithFrequency(tenancy: TenancyRentLike): string {
  const amount = getRentAmountPence(tenancy);
  const frequency = getRentFrequency(tenancy).toLowerCase();
  return `${formatMoney(amount)} / ${frequency}`;
}

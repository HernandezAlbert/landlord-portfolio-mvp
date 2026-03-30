export type Rag = "RED" | "AMBER" | "GREEN";

export function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function ragFromDaysRemaining(days: number | null): Rag {
  if (days === null) return "AMBER";
  if (days <= 30) return "RED";
  if (days <= 60) return "AMBER";
  return "GREEN";
}

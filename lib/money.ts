export type MoneyInput = FormDataEntryValue | string | number | null | undefined;

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function poundsToPence(input: MoneyInput): number {
  const raw =
    typeof input === "number"
      ? String(input)
      : String(input ?? "").replace(/,/g, "").trim();

  if (!raw) return 0;

  const pounds = Number(raw);
  return Number.isFinite(pounds) ? Math.round(pounds * 100) : 0;
}

export function poundsToPenceOrNull(input: MoneyInput): number | null {
  const raw =
    typeof input === "number"
      ? String(input)
      : String(input ?? "").replace(/,/g, "").trim();

  if (!raw) return null;

  const pounds = Number(raw);
  return Number.isFinite(pounds) ? Math.round(pounds * 100) : null;
}

export function penceToPounds(value: number | null | undefined): number {
  return (value ?? 0) / 100;
}

export function penceToPoundsInputValue(value: number | null | undefined): string {
  return penceToPounds(value).toFixed(2);
}

export function penceToPoundsDecimalString(value: number | null | undefined): string {
  return penceToPounds(value).toFixed(2);
}

export function formatGBPFromPence(value: number | null | undefined): string {
  return gbpFormatter.format(penceToPounds(value));
}

import type { ApplicantDecision } from "./applicants";

export type ImportedApplicantPayload = {
  externalKey: string;
  submittedAt?: Date | string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  employmentStatus?: string | null;
  monthlyIncome?: number | null; // stored in pence
  requestedMoveIn?: Date | string | null;
  adults?: number | null;
  children?: number | null;
  hasPets?: boolean | null;
  petDetails?: string | null;
  notes?: string | null;
  rawPayload?: Record<string, string>;
  adverseCredit?: boolean | null;
  petInsurance?: boolean | null;
  landlordReferenceAvailable?: boolean | null;
  canProvideGuarantor?: boolean | null;
};

export type ScreeningConfig = {
  passMultiplier: number;
  guarantorMinMultiplier: number;
  hardFailMultiplier: number;
};

export type ScreeningResult = {
  score: number;
  screeningStatus:
    | "ACCEPT"
    | "ACCEPT_WITH_GUARANTOR"
    | "REVIEW"
    | "DECLINE"
    | "INSUFFICIENT_DATA";
  screeningSummary: string;
  screeningReason: string;
  affordabilityRatio: number | null;
  incomeUsed: number | null;
  rentUsed: number | null;
  thresholds: ScreeningConfig;
  reasons: string[];
  decision: ApplicantDecision;
  creditCheckPassed: boolean | null;
  guarantorRequired: boolean;
};

type Row = Record<string, string | null | undefined>;

const BASE_MONTHLY_INCOME_KEYS = [
  "Monthly Income",
  "Net Monthly Income",
  "Income per month",
  "Monthly household income",
  "Monthly take home pay",
];
const BASE_ANNUAL_INCOME_KEYS = [
  "Approx Annual Income",
  "Annual Income",
  "Gross Annual Income",
  "Net Annual Income",
  "Household Income",
  "Income",
];
const ADDITIONAL_MONTHLY_INCOME_KEYS = [
  "Additional Monthly Income",
  "Other Monthly Income",
  "Monthly Additional Income",
];
const ADDITIONAL_ANNUAL_INCOME_KEYS = [
  "Additional Income",
  "Other Income",
  "Additional Annual Income",
  "Other Annual Income",
  "Approx Annual Additional Income",
];

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value)
    .replace(/[£$€]/g, "")
    .replace(/,/g, "")
    .trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function penceFromPounds(value: number | null) {
  return value === null ? null : Math.round(value * 100);
}

function pick(row: Row, candidates: string[]): string | null {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate);
    const found = entries.find(([key]) => normalizeKey(key) === normalizedCandidate);
    if (found) return found[1] ?? null;
  }
  return null;
}

function pickByPredicates(row: Row, predicates: Array<(key: string) => boolean>): string | null {
  for (const [key, value] of Object.entries(row)) {
    const lower = key.toLowerCase();
    if (predicates.every((fn) => fn(lower))) {
      const normalized = normalizeText(value);
      if (normalized) return normalized;
    }
  }
  return null;
}

function toBool(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  const v = value.trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(v)) return true;
  if (["no", "n", "false", "0"].includes(v)) return false;
  return null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      row.push(current.trim());
      const hasAnyValue = row.some((cell) => cell.trim() !== "");
      if (hasAnyValue) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function getMatchedValue(row: Row, exactCandidates: string[], fuzzyFallback?: (key: string) => boolean): string | null {
  const exact = pick(row, exactCandidates);
  if (normalizeText(exact)) return exact;
  if (!fuzzyFallback) return null;

  for (const [key, value] of Object.entries(row)) {
    if (fuzzyFallback(key.toLowerCase())) {
      const normalized = normalizeText(value);
      if (normalized) return normalized;
    }
  }
  return null;
}

function getBaseMonthlyIncomePounds(row: Row): number | null {
  return safeNumber(
    getMatchedValue(
      row,
      BASE_MONTHLY_INCOME_KEYS,
      (key) => key.includes("monthly") && key.includes("income") && !key.includes("additional") && !key.includes("other"),
    ),
  );
}

function getBaseAnnualIncomePounds(row: Row): number | null {
  return safeNumber(
    getMatchedValue(
      row,
      BASE_ANNUAL_INCOME_KEYS,
      (key) => key.includes("annual") && key.includes("income") && !key.includes("additional") && !key.includes("other"),
    ),
  );
}

function getAdditionalMonthlyIncomePounds(row: Row): number | null {
  return safeNumber(
    getMatchedValue(
      row,
      ADDITIONAL_MONTHLY_INCOME_KEYS,
      (key) => key.includes("monthly") && (key.includes("additional") || key.includes("other")) && key.includes("income"),
    ),
  );
}

function getAdditionalAnnualIncomePounds(row: Row): number | null {
  return safeNumber(
    getMatchedValue(
      row,
      ADDITIONAL_ANNUAL_INCOME_KEYS,
      (key) => !key.includes("monthly") && (key.includes("additional") || key.includes("other")) && key.includes("income"),
    ),
  );
}

export function getIncomeBreakdownFromRow(row: Row) {
  const baseMonthly = getBaseMonthlyIncomePounds(row);
  const baseAnnual = getBaseAnnualIncomePounds(row);
  const additionalMonthly = getAdditionalMonthlyIncomePounds(row);
  const additionalAnnual = getAdditionalAnnualIncomePounds(row);

  const inferredBaseMonthly = baseMonthly ?? (baseAnnual !== null ? baseAnnual / 12 : null);
  const inferredAdditionalMonthly = additionalMonthly ?? (additionalAnnual !== null ? additionalAnnual / 12 : null);

  const totalMonthlyPounds = (inferredBaseMonthly ?? 0) + (inferredAdditionalMonthly ?? 0);

  return {
    baseMonthlyPounds: inferredBaseMonthly,
    additionalMonthlyPounds: inferredAdditionalMonthly,
    totalMonthlyPounds: totalMonthlyPounds > 0 ? totalMonthlyPounds : null,
    baseMonthlyPence: penceFromPounds(inferredBaseMonthly),
    additionalMonthlyPence: penceFromPounds(inferredAdditionalMonthly),
    totalMonthlyPence: penceFromPounds(totalMonthlyPounds > 0 ? totalMonthlyPounds : null),
  };
}

export function getIncomeBreakdownFromRawPayload(rawPayload: unknown) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return {
      baseMonthlyPence: null,
      additionalMonthlyPence: null,
      totalMonthlyPence: null,
    };
  }
  return getIncomeBreakdownFromRow(rawPayload as Row);
}

export function extractGuarantor(row: Row): boolean | null {
  const explicit = toBool(
    pick(row, ["Guarantor", "Can Provide Guarantor"]),
  );
  if (explicit !== null) return explicit;

  const fuzzy = pickByPredicates(row, [
    (key) => key.includes("guarantor"),
    (key) => key.includes("provide") || key.includes("able") || key.includes("willing") || key.includes("affordability"),
  ]);
  return toBool(fuzzy);
}

function deriveExternalKey(row: Row, index: number, fullName: string) {
  const explicit = pick(row, ["Timestamp", "Submitted At", "Submission Id"]);
  if (explicit) return explicit;

  const email = normalizeText(pick(row, ["Email", "Email Address"])).toLowerCase();
  const phone = normalizeText(pick(row, ["Phone", "Phone Number", "Mobile"]));
  const moveIn = normalizeText(pick(row, ["Requested Move In", "Move In Date", "Desired Move-in Date"]));
  return [fullName.trim().toLowerCase(), email, phone, moveIn, index + 1].filter(Boolean).join("|");
}

function mapRowObjects(rows: Row[]): ImportedApplicantPayload[] {
  return rows
    .map((row, index) => {
      const fullName =
        pick(row, ["Full Name", "Name", "Applicant Name"])?.trim() ??
        `Applicant ${index + 1}`;
      const income = getIncomeBreakdownFromRow(row);

      return {
        externalKey: deriveExternalKey(row, index, fullName),
        submittedAt: toDate(pick(row, ["Timestamp", "Submitted At"])),
        fullName,
        email: pick(row, ["Email", "Email Address"]),
        phone: pick(row, ["Phone", "Phone Number", "Mobile"]),
        employmentStatus: pick(row, ["Employment Status", "Employment"]),
        monthlyIncome: income.totalMonthlyPence,
        requestedMoveIn: toDate(pick(row, ["Requested Move In", "Move In Date", "Desired Move-in Date"])),
        adults: safeNumber(pick(row, ["Adults", "Number of Adults", "How many adults will be moving in?"])) ?? 1,
        children: safeNumber(pick(row, ["Children", "Number of Children", "How many children will be moving in?"])) ?? 0,
        hasPets: toBool(pick(row, ["Pets", "Any Pets", "Do You Have Pets"])),
        petDetails: pick(row, ["Pet Details", "Pets Details"]),
        notes: pick(row, ["Notes", "Additional Notes"]),
        rawPayload: Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, v ?? ""]),
        ),
        adverseCredit: toBool(
          pick(row, [
            "Adverse Credit",
            "CCJ / IVA / Bankruptcy",
            "Any adverse credit history?",
          ]),
        ),
        petInsurance: toBool(
          pick(row, ["Pet Insurance", "Will you obtain pet insurance?"]),
        ),
        landlordReferenceAvailable: toBool(
          pick(row, ["Landlord Reference", "Can provide landlord reference"]),
        ),
        canProvideGuarantor: extractGuarantor(row),
      } satisfies ImportedApplicantPayload;
    })
    .filter((row) => !!normalizeText(row.fullName));
}

export function coerceGoogleSheetCsvUrl(input: string) {
  if (!input) return "";
  if (input.includes("output=csv")) return input;

  const match = input.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) return input;

  const sheetId = match[1];
  const gidMatch = input.match(/[?&]gid=(\d+)/);
  const gid = gidMatch?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

export function mapGoogleFormRows(csvText: string): ImportedApplicantPayload[] {
  const parsed = parseCsv(csvText);
  if (!parsed.length) return [];

  const [headerRow, ...dataRows] = parsed;
  const headers = headerRow.map((value) => value.trim());
  const mappedRows = dataRows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const obj: Row = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] ?? null;
      });
      return obj;
    });

  return mapRowObjects(mappedRows);
}

export function mapGoogleFormTable(table: string[][]): ImportedApplicantPayload[] {
  if (!table.length) return [];
  const [headerRow, ...dataRows] = table;
  const headers = headerRow.map((value) => value.trim());

  const rows = dataRows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => {
      const obj: Row = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] ?? null;
      });
      return obj;
    });

  return mapRowObjects(rows);
}

export function screenImportedApplicant(
  applicant: ImportedApplicantPayload,
  rentMonthly: number | null | undefined,
  config?: Partial<ScreeningConfig>,
): ScreeningResult {
  const thresholds: ScreeningConfig = {
    passMultiplier: config?.passMultiplier ?? 3.0,
    guarantorMinMultiplier: config?.guarantorMinMultiplier ?? 2.0,
    hardFailMultiplier: config?.hardFailMultiplier ?? 1.5,
  };

  const guarantorFloor = thresholds.guarantorMinMultiplier;
  const hardFailFloor = thresholds.hardFailMultiplier;

  const income = safeNumber(applicant.monthlyIncome);
  const rent = safeNumber(rentMonthly);
  const ratio = income && rent && rent > 0 ? Number((income / rent).toFixed(2)) : null;
  const reasons: string[] = [];

  if (applicant.adverseCredit === true) {
    reasons.push("Adverse credit disclosed.");
    return {
      score: 10,
      screeningStatus: "DECLINE",
      screeningSummary: "Fail",
      screeningReason: "Adverse credit disclosed.",
      affordabilityRatio: ratio,
      incomeUsed: income,
      rentUsed: rent,
      thresholds,
      reasons,
      decision: "DECLINE",
      creditCheckPassed: null,
      guarantorRequired: false,
    };
  }

  if (!rent || rent <= 0) {
    reasons.push("No advertised or active rent was found, so affordability could not be checked.");
    return {
      score: 25,
      screeningStatus: "INSUFFICIENT_DATA",
      screeningSummary: "Insufficient data",
      screeningReason: "No advertised or active rent was found for this property, so affordability could not be checked.",
      affordabilityRatio: ratio,
      incomeUsed: income,
      rentUsed: rent,
      thresholds,
      reasons,
      decision: "REVIEW",
      creditCheckPassed: null,
      guarantorRequired: false,
    };
  }

  if (!income || income <= 0) {
    reasons.push("No income provided.");
    return {
      score: 20,
      screeningStatus: "REVIEW",
      screeningSummary: "Review",
      screeningReason: "No income was provided, so affordability could not pass screening.",
      affordabilityRatio: ratio,
      incomeUsed: income,
      rentUsed: rent,
      thresholds,
      reasons,
      decision: "REVIEW",
      creditCheckPassed: null,
      guarantorRequired: false,
    };
  }

  const employmentStatus = (applicant.employmentStatus ?? "").trim();
  if (!employmentStatus) {
    reasons.push("No employment details provided.");
    return {
      score: 25,
      screeningStatus: "REVIEW",
      screeningSummary: "Review",
      screeningReason: "No employment details were provided, so screening needs review.",
      affordabilityRatio: ratio,
      incomeUsed: income,
      rentUsed: rent,
      thresholds,
      reasons,
      decision: "REVIEW",
      creditCheckPassed: null,
      guarantorRequired: false,
    };
  }

  if (ratio !== null && ratio >= thresholds.passMultiplier) {
    reasons.push(`Affordability passes at ${ratio.toFixed(2)}x rent against a ${thresholds.passMultiplier.toFixed(1)}x target.`);
    return {
      score: 85,
      screeningStatus: "ACCEPT",
      screeningSummary: "Pass",
      screeningReason: `Affordability passes at ${ratio.toFixed(2)}x rent.`,
      affordabilityRatio: ratio,
      incomeUsed: income,
      rentUsed: rent,
      thresholds,
      reasons,
      decision: "REVIEW",
      creditCheckPassed: null,
      guarantorRequired: false,
    };
  }

  if (ratio !== null && ratio >= guarantorFloor && applicant.canProvideGuarantor) {
    reasons.push(`Affordability is ${ratio.toFixed(2)}x rent, below the pass target but acceptable with a guarantor.`);
    reasons.push("Applicant says a guarantor can be provided.");
    return {
      score: 65,
      screeningStatus: "ACCEPT_WITH_GUARANTOR",
      screeningSummary: "Guarantor required",
      screeningReason: `Affordability is ${ratio.toFixed(2)}x rent, below the minimum threshold but acceptable with a guarantor.`,
      affordabilityRatio: ratio,
      incomeUsed: income,
      rentUsed: rent,
      thresholds,
      reasons,
      decision: "ACCEPT_WITH_GUARANTOR",
      creditCheckPassed: null,
      guarantorRequired: true,
    };
  }

  if (ratio !== null && ratio >= guarantorFloor) {
    reasons.push(`Affordability is ${ratio.toFixed(2)}x rent, but no guarantor was offered.`);
    return {
      score: 45,
      screeningStatus: "REVIEW",
      screeningSummary: "Review",
      screeningReason: `Affordability is ${ratio.toFixed(2)}x rent, which is below the minimum threshold and no guarantor was confirmed.`,
      affordabilityRatio: ratio,
      incomeUsed: income,
      rentUsed: rent,
      thresholds,
      reasons,
      decision: "REVIEW",
      creditCheckPassed: null,
      guarantorRequired: true,
    };
  }

  if (ratio !== null && ratio >= hardFailFloor) {
    reasons.push(`Affordability is ${ratio.toFixed(2)}x rent, below the minimum threshold and not strong enough for automatic approval.`);
    return {
      score: 25,
      screeningStatus: "REVIEW",
      screeningSummary: "Review",
      screeningReason: `Affordability is ${ratio.toFixed(2)}x rent, below the minimum threshold and not strong enough for automatic approval, so it needs manual review.`,
      affordabilityRatio: ratio,
      incomeUsed: income,
      rentUsed: rent,
      thresholds,
      reasons,
      decision: "REVIEW",
      creditCheckPassed: null,
      guarantorRequired: false,
    };
  }

  reasons.push(`Affordability below the hard-fail threshold at ${ratio?.toFixed(2) ?? "0.00"}x rent.`);
  return {
    score: 20,
    screeningStatus: "DECLINE",
    screeningSummary: "Fail",
    screeningReason: `Affordability below the hard-fail threshold at ${ratio?.toFixed(2) ?? "0.00"}x rent.`,
    affordabilityRatio: ratio,
    incomeUsed: income,
    rentUsed: rent,
    thresholds,
    reasons,
    decision: "DECLINE",
    creditCheckPassed: null,
    guarantorRequired: false,
  };
}

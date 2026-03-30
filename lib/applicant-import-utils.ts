export type DuplicateApplicantCandidate = {
  id?: string;
  importExternalKey: string | null;
  email: string | null;
  phone: string | null;
  fullName: string;
  importSubmittedAt: Date | null;
};

export type DuplicateApplicantRow = {
  externalKey: string;
  email?: string | null;
  phone?: string | null;
  fullName: string;
  submittedAt?: Date | string | null;
};

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export function applicantLooksDuplicate(
  existing: DuplicateApplicantCandidate[],
  row: DuplicateApplicantRow,
) {
  const normalizedEmail = normalizeEmail(row.email);
  const normalizedPhone = normalizePhone(row.phone);
  const normalizedName = normalizeName(row.fullName);
  const submittedAt = row.submittedAt ? new Date(row.submittedAt) : null;

  return existing.find((candidate) => {
    if (candidate.importExternalKey && candidate.importExternalKey === row.externalKey) return true;

    const sameEmail = normalizedEmail && normalizeEmail(candidate.email) === normalizedEmail;
    const samePhone = normalizedPhone && normalizePhone(candidate.phone) === normalizedPhone;
    const sameName = normalizeName(candidate.fullName) === normalizedName;
    const sameSubmittedAt =
      submittedAt &&
      candidate.importSubmittedAt &&
      candidate.importSubmittedAt.getTime() === submittedAt.getTime();

    return Boolean(
      (sameSubmittedAt && sameEmail) ||
      (sameEmail && sameName) ||
      (samePhone && sameName),
    );
  });
}

export function buildApplicantDuplicateKeys(candidate: {
  importExternalKey?: string | null;
  email?: string | null;
  phone?: string | null;
  fullName: string;
  importSubmittedAt?: Date | string | null;
}) {
  const normalizedName = normalizeName(candidate.fullName);
  const normalizedEmail = normalizeEmail(candidate.email);
  const normalizedPhone = normalizePhone(candidate.phone);
  const submittedAt =
    candidate.importSubmittedAt instanceof Date
      ? candidate.importSubmittedAt.toISOString()
      : candidate.importSubmittedAt
        ? new Date(candidate.importSubmittedAt).toISOString()
        : "";

  const keys = new Set<string>();

  if (candidate.importExternalKey) {
    keys.add(`external:${candidate.importExternalKey}`);
  }

  if (normalizedEmail && normalizedName) {
    keys.add(`email-name:${normalizedEmail}|${normalizedName}`);
  }

  if (normalizedPhone && normalizedName) {
    keys.add(`phone-name:${normalizedPhone}|${normalizedName}`);
  }

  if (submittedAt && normalizedEmail) {
    keys.add(`submitted-email:${submittedAt}|${normalizedEmail}`);
  }

  return Array.from(keys);
}

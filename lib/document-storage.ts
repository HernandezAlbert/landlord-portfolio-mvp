import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const DOCUMENT_STORAGE_KEYS = [
  "EXPENSE_RECEIPTS_DIR",
  "APPLICANT_VETTING_DIR",
  "APPLICANT_REFERENCES_DIR",
  "APPLICATIONS_DIR",
  "CONTRACTS_DIR",
] as const;

export type DocumentStorageKey = (typeof DOCUMENT_STORAGE_KEYS)[number];

export const DOCUMENT_STORAGE_LABELS: Record<DocumentStorageKey, string> = {
  EXPENSE_RECEIPTS_DIR: "Expense receipts",
  APPLICANT_VETTING_DIR: "Applicant vetting documents",
  APPLICANT_REFERENCES_DIR: "Applicant reference documents",
  APPLICATIONS_DIR: "Applications",
  CONTRACTS_DIR: "Contracts",
};

export const DEFAULT_DOCUMENT_STORAGE_PATHS: Record<DocumentStorageKey, string> = {
  EXPENSE_RECEIPTS_DIR: path.join(process.cwd(), "public", "uploads", "expense-receipts"),
  APPLICANT_VETTING_DIR: path.join(process.cwd(), "public", "uploads", "applicants", "vetting"),
  APPLICANT_REFERENCES_DIR: path.join(process.cwd(), "public", "uploads", "applicants", "references"),
  APPLICATIONS_DIR: path.join(process.cwd(), "public", "uploads", "applications"),
  CONTRACTS_DIR: path.join(process.cwd(), "public", "uploads", "contracts"),
};

const LEGACY_ALLOWED_ROOTS = [
  path.join(process.cwd(), "public", "uploads", "expense-receipts"),
  path.join(process.cwd(), "public", "uploads", "applicants"),
  path.join(process.cwd(), "public", "uploads", "applications"),
  path.join(process.cwd(), "public", "uploads", "contracts"),
];

export async function getDocumentStorageSettings() {
  const rows = await prisma.documentStorageSetting.findMany({
    where: { key: { in: [...DOCUMENT_STORAGE_KEYS] } },
    orderBy: { key: "asc" },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return DOCUMENT_STORAGE_KEYS.map((key) => ({
    key,
    label: DOCUMENT_STORAGE_LABELS[key],
    value: byKey.get(key) ?? DEFAULT_DOCUMENT_STORAGE_PATHS[key],
    defaultValue: DEFAULT_DOCUMENT_STORAGE_PATHS[key],
  }));
}

export async function getDocumentStoragePath(key: DocumentStorageKey) {
  const row = await prisma.documentStorageSetting.findUnique({ where: { key } });
  const configured = (row?.value ?? "").trim();
  return normalizeConfiguredPath(configured || DEFAULT_DOCUMENT_STORAGE_PATHS[key]);
}

export async function saveDocumentStorageSettings(values: Partial<Record<DocumentStorageKey, string>>) {
  for (const key of DOCUMENT_STORAGE_KEYS) {
    const raw = (values[key] ?? "").trim() || DEFAULT_DOCUMENT_STORAGE_PATHS[key];
    await prisma.documentStorageSetting.upsert({
      where: { key },
      create: { key, value: raw },
      update: { value: raw },
    });
  }
}

export function normalizeConfiguredPath(input: string) {
  return path.isAbsolute(input) ? path.normalize(input) : path.resolve(process.cwd(), input);
}

export function buildFileAccessUrl(absolutePath: string) {
  return `/api/files?path=${encodeURIComponent(Buffer.from(absolutePath).toString("base64url"))}`;
}

export function decodeFileAccessUrlPath(encoded: string | null | undefined) {
  if (!encoded) return null;
  try {
    return path.normalize(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function getAllowedDocumentRoots() {
  const configured = await Promise.all(DOCUMENT_STORAGE_KEYS.map((key) => getDocumentStoragePath(key)));
  return Array.from(new Set([...configured, ...LEGACY_ALLOWED_ROOTS].map((value) => path.normalize(value))));
}

export function isPathWithinRoot(candidatePath: string, rootPath: string) {
  const candidate = path.resolve(candidatePath);
  const root = path.resolve(rootPath);
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function ensureDirectoryExists(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

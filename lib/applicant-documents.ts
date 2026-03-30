import fs from "node:fs/promises";
import path from "node:path";
import { ReferencingCheck } from "@prisma/client";
import { buildFileAccessUrl, getDocumentStoragePath } from "@/lib/document-storage";

export type UploadedApplicantDoc = {
  storedName: string;
  originalName: string;
  docType: string;
  filePath: string;
  absolutePath: string;
  createdAt: Date | null;
};

export const APPLICANT_DOC_TYPES = [
  "ID",
  "RIGHT_TO_RENT",
  "PAYSLIP",
  "BANK_STATEMENT",
  "EMPLOYER_REFERENCE",
  "LANDLORD_REFERENCE",
  "PET_INSURANCE",
  "GUARANTOR",
  "OTHER",
] as const;

export function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function documentTypeLabel(type: string) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function applicantDocStorageKeyForType(type: string) {
  switch (type) {
    case "EMPLOYER_REFERENCE":
    case "LANDLORD_REFERENCE":
      return "APPLICANT_REFERENCES_DIR" as const;
    default:
      return "APPLICANT_VETTING_DIR" as const;
  }
}

export async function applicantUploadFolder(applicantId: string, docType = "OTHER") {
  const baseDir = await getDocumentStoragePath(applicantDocStorageKeyForType(docType));
  return path.join(baseDir, applicantId);
}

async function applicantSearchFolders(applicantId: string) {
  const [vettingDir, referencesDir, applicationsDir] = await Promise.all([
    getDocumentStoragePath("APPLICANT_VETTING_DIR"),
    getDocumentStoragePath("APPLICANT_REFERENCES_DIR"),
    getDocumentStoragePath("APPLICATIONS_DIR"),
  ]);

  return Array.from(new Set([
    path.join(vettingDir, applicantId),
    path.join(referencesDir, applicantId),
    path.join(applicationsDir, applicantId),
    path.join(process.cwd(), "public", "uploads", "applicants", applicantId),
  ]));
}

export async function getUploadedApplicantDocs(applicantId: string): Promise<UploadedApplicantDoc[]> {
  const folders = await applicantSearchFolders(applicantId);
  const docs: UploadedApplicantDoc[] = [];

  for (const folder of folders) {
    try {
      const entries = await fs.readdir(folder);
      for (const name of entries) {
        const absolutePath = path.join(folder, name);
        const stat = await fs.stat(absolutePath);
        if (!stat.isFile()) continue;
        const parts = name.split("__");
        const docType = parts.length > 1 ? parts[1] : "OTHER";
        const originalName = parts.length > 2 ? parts.slice(2).join("__") : name;
        docs.push({
          storedName: name,
          originalName,
          docType,
          filePath: buildFileAccessUrl(absolutePath),
          absolutePath,
          createdAt: stat.birthtime ?? stat.mtime ?? null,
        });
      }
    } catch {
      // ignore missing folders
    }
  }

  const deduped = new Map<string, UploadedApplicantDoc>();
  for (const doc of docs) {
    const existing = deduped.get(doc.absolutePath);
    if (!existing || (doc.createdAt?.getTime() ?? 0) > (existing.createdAt?.getTime() ?? 0)) {
      deduped.set(doc.absolutePath, doc);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export async function resolveApplicantStoredDocPath(applicantId: string, storedName: string) {
  const folders = await applicantSearchFolders(applicantId);
  for (const folder of folders) {
    const candidate = path.join(folder, storedName);
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

export type MissingDocEmail = {
  subject: string;
  text: string;
  html: string;
  missingItems: string[];
};

export function buildMissingDocumentEmail(args: {
  applicantName: string;
  propertyName?: string | null;
  uploadedDocs: UploadedApplicantDoc[];
  referencing?: Pick<ReferencingCheck, "idProvided" | "rightToRentChecked" | "payslipsProvided" | "bankStatementsProvided" | "employmentReference" | "landlordReference" | "guarantorRequired" | "guarantorProvided" | "petInsuranceProvided"> | null;
  hasPets?: boolean | null;
}) : MissingDocEmail {
  const uploadedTypes = new Set(args.uploadedDocs.map((doc) => doc.docType));
  const isUploaded = (type: string) => uploadedTypes.has(type);
  const missingItems: string[] = [];
  const pushMissing = (label: string, missing: boolean) => {
    if (missing) missingItems.push(label);
  };

  pushMissing("Photo ID / passport", !args.referencing?.idProvided && !isUploaded("ID"));
  pushMissing("Right to Rent evidence / share code", !args.referencing?.rightToRentChecked && !isUploaded("RIGHT_TO_RENT"));
  pushMissing("Last 3 payslips or SA302s", !args.referencing?.payslipsProvided && !isUploaded("PAYSLIP"));
  pushMissing("Last 3 bank statements", !args.referencing?.bankStatementsProvided && !isUploaded("BANK_STATEMENT"));
  pushMissing("Employer reference / employment confirmation", !args.referencing?.employmentReference && !isUploaded("EMPLOYER_REFERENCE"));
  pushMissing("Previous landlord reference", !args.referencing?.landlordReference && !isUploaded("LANDLORD_REFERENCE"));

  if (args.hasPets) {
    pushMissing("Pet insurance / pet supporting documents", !args.referencing?.petInsuranceProvided && !isUploaded("PET_INSURANCE"));
  }

  if (args.referencing?.guarantorRequired) {
    pushMissing("Guarantor documents", !args.referencing?.guarantorProvided && !isUploaded("GUARANTOR"));
  }

  const subject = `Documents needed to complete your referencing${args.propertyName ? ` - ${args.propertyName}` : ""}`;
  const intro = `Dear ${args.applicantName},\n\nThank you for your application${args.propertyName ? ` for ${args.propertyName}` : ""}. To complete your referencing, please send the following outstanding documents:`;
  const bulletList = missingItems.length
    ? missingItems.map((item) => `- ${item}`).join("\n")
    : "- No outstanding referencing documents currently flagged.";
  const closing = `\n\nPlease reply to this email with the documents attached, or let us know if you have already sent any of them.\n\nKind regards,\nLandlord Portfolio`;
  const text = `${intro}\n\n${bulletList}${closing}`;
  const html = `<p>Dear ${escapeHtml(args.applicantName)},</p><p>Thank you for your application${args.propertyName ? ` for <strong>${escapeHtml(args.propertyName)}</strong>` : ""}. To complete your referencing, please send the following outstanding documents:</p>${missingItems.length ? `<ul>${missingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p><strong>No outstanding referencing documents are currently flagged.</strong></p>`}<p>Please reply to this email with the documents attached, or let us know if you have already sent any of them.</p><p>Kind regards,<br/>Landlord Portfolio</p>`;

  return { subject, text, html, missingItems };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

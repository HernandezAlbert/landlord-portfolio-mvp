import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { applicantUploadFolder, sanitizeFileName } from "@/lib/applicant-documents";
import { syncApplicantReferencingFromDocs } from "@/lib/applicant-referencing-sync";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const formData = await request.formData();
  const file = formData.get("file");
  const docType = String(formData.get("docType") ?? "OTHER").trim() || "OTHER";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.redirect(new URL(`/applicants/${id}?upload=empty`, request.url), 303);
  }

  const folder = await applicantUploadFolder(id, docType);
  await fs.mkdir(folder, { recursive: true });

  const storedName = `${Date.now()}__${docType}__${sanitizeFileName(file.name)}`;
  const diskPath = path.join(folder, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(diskPath, buffer);
  await syncApplicantReferencingFromDocs(id);

  return NextResponse.redirect(new URL(`/applicants/${id}?upload=ok`, request.url), 303);
}

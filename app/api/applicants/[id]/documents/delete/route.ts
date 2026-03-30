import path from "node:path";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveApplicantStoredDocPath } from "@/lib/applicant-documents";
import { syncApplicantReferencingFromDocs } from "@/lib/applicant-referencing-sync";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const formData = await request.formData();
  const storedName = String(formData.get("storedName") ?? "").trim();

  if (!storedName) {
    return NextResponse.redirect(new URL(`/applicants/${id}?deleteDoc=missing`, request.url), 303);
  }

  const safeName = path.basename(storedName);
  const absolutePath = await resolveApplicantStoredDocPath(id, safeName);
  if (absolutePath) await fs.unlink(absolutePath).catch(() => null);
  await syncApplicantReferencingFromDocs(id);
  return NextResponse.redirect(new URL(`/applicants/${id}?deleteDoc=ok`, request.url), 303);
}

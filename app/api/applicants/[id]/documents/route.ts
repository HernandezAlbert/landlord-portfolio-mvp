import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { saveApplicantDocument } from "@/lib/applicant-documents";
import { syncApplicantReferencingFromDocs } from "@/lib/applicant-referencing-sync";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const { id } = await context.params;

  const applicant = await prisma.applicant.findFirst({
    where: {
      id,
      userId: sessionUser.id,
    },
    select: {
      id: true,
    },
  });

  if (!applicant) {
    return NextResponse.redirect(new URL("/applicants", request.url), 303);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const docType = String(formData.get("docType") ?? "OTHER").trim() || "OTHER";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.redirect(
      new URL(`/applicants/${applicant.id}?upload=empty`, request.url),
      303,
    );
  }

  try {
    await saveApplicantDocument({
      applicantId: applicant.id,
      docType,
      file,
    });
    await syncApplicantReferencingFromDocs(applicant.id);
  } catch (error) {
    console.error("Applicant document upload failed", error);
    return NextResponse.redirect(
      new URL(`/applicants/${applicant.id}?upload=error`, request.url),
      303,
    );
  }

  return NextResponse.redirect(
    new URL(`/applicants/${applicant.id}?upload=ok`, request.url),
    303,
  );
}

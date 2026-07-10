import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { deleteApplicantDocument } from "@/lib/applicant-documents";
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
  const documentId = String(formData.get("documentId") ?? "").trim();
  const storedName = String(formData.get("storedName") ?? "").trim();

  if (!documentId && !storedName) {
    return NextResponse.redirect(
      new URL(`/applicants/${applicant.id}?deleteDoc=missing`, request.url),
      303,
    );
  }

  await deleteApplicantDocument({
    applicantId: applicant.id,
    documentId,
    storedName,
  });
  await syncApplicantReferencingFromDocs(applicant.id);

  return NextResponse.redirect(
    new URL(`/applicants/${applicant.id}?deleteDoc=ok`, request.url),
    303,
  );
}

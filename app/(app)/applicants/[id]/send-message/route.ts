import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildApplicantMessageDraft, paragraphize, type ApplicantMessageTemplateKey } from "@/lib/applicant-messaging";
import { sendEmailSafe } from "@/lib/email";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const formData = await request.formData();

  const template = String(formData.get("template") ?? "") as ApplicantMessageTemplateKey;
  const applicant = await prisma.applicant.findUnique({
    where: { id },
    include: { property: true },
  });

  if (!applicant) {
    return NextResponse.redirect(new URL("/applicants", request.url), 303);
  }

  if (!applicant.email) {
    return NextResponse.redirect(
      new URL(`/applicants/${id}?messageError=${encodeURIComponent("Add an email address before sending applicant messages.")}`, request.url),
      303,
    );
  }

  const draft = buildApplicantMessageDraft(applicant, template);
  const subject = String(formData.get("subject") ?? "").trim() || draft.subject;
  const text = String(formData.get("body") ?? "").trim() || draft.text;

  const result = await sendEmailSafe({
    to: applicant.email,
    subject,
    text,
    html: paragraphize(text),
  });

  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/applicants/${id}?messageError=${encodeURIComponent(result.error)}`, request.url),
      303,
    );
  }

  if (draft.statusAfterSend) {
    await prisma.applicant.update({
      where: { id },
      data: { status: draft.statusAfterSend },
    });
  }

  revalidatePath(`/applicants/${id}`);
  revalidatePath(`/applicants`);

  return NextResponse.redirect(
    new URL(`/applicants/${id}?messageSent=${encodeURIComponent(`${draft.label} email sent.`)}`, request.url),
    303,
  );
}

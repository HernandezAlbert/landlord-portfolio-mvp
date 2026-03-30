import type { Applicant, Property } from "@prisma/client";

export type ApplicantWithProperty = Applicant & { property?: Property | null };

export type ApplicantMessageTemplateKey =
  | "REJECT_VIEWING"
  | "REQUEST_GUARANTOR"
  | "REJECT_TENANCY"
  | "INVITE_VIEWING";

export type ApplicantMessageDraft = {
  key: ApplicantMessageTemplateKey;
  label: string;
  subject: string;
  text: string;
  html: string;
  statusAfterSend?: Applicant["status"];
};

export function paragraphize(text: string) {
  return text
    .split("\n\n")
    .map((block) => `<p style="margin:0 0 12px;">${block.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function propertyLabel(applicant: ApplicantWithProperty) {
  return applicant.property?.name ? ` for ${applicant.property.name}` : "";
}

export function buildApplicantMessageDraft(applicant: ApplicantWithProperty, key: ApplicantMessageTemplateKey): ApplicantMessageDraft {
  const name = applicant.fullName.split(" ")[0] || applicant.fullName;
  const propertyText = propertyLabel(applicant);

  if (key === "REJECT_VIEWING") {
    const subject = `Update on your property enquiry${propertyText}`;
    const text = `Dear ${name},\n\nThank you for your enquiry${propertyText}. Due to the level of interest, we will not be progressing your application to the viewing stage at this time.\n\nThank you again for your interest, and we wish you all the best in your property search.\n\nKind regards\nLandlord Portfolio`;
    return { key, label: "Reject before viewing", subject, text, html: paragraphize(text), statusAfterSend: "REJECTED" };
  }

  if (key === "REQUEST_GUARANTOR") {
    const subject = `Guarantor information required${propertyText}`;
    const text = `Dear ${name},\n\nThank you for your interest${propertyText}. Based on the information provided so far, we may be able to proceed subject to a suitable UK-based guarantor meeting the required criteria.\n\nPlease reply to confirm whether this is available, and we can then advise on the next steps.\n\nKind regards\nLandlord Portfolio`;
    return { key, label: "Request guarantor", subject, text, html: paragraphize(text), statusAfterSend: "MORE_INFO_REQUESTED" };
  }

  if (key === "INVITE_VIEWING") {
    const subject = `Viewing invitation${propertyText}`;
    const text = `Dear ${name},\n\nThank you for your enquiry${propertyText}. We would be happy to invite you to a viewing.\n\nPlease reply with your availability and we will confirm the next available slot.\n\nKind regards\nLandlord Portfolio`;
    return { key, label: "Invite to viewing", subject, text, html: paragraphize(text) };
  }

  const subject = `Update on your tenancy application${propertyText}`;
  const text = `Dear ${name},\n\nThank you for your time and for completing the application process${propertyText}. After careful consideration, we will not be progressing your application further, as we have decided to proceed with another applicant.\n\nWe appreciate the time you have taken and wish you all the best in securing a suitable property.\n\nKind regards\nLandlord Portfolio`;
  return { key, label: "Not offering tenancy", subject, text, html: paragraphize(text), statusAfterSend: "REJECTED" };
}

export function allApplicantMessageDrafts(applicant: ApplicantWithProperty) {
  return (["INVITE_VIEWING", "REQUEST_GUARANTOR", "REJECT_VIEWING", "REJECT_TENANCY"] as ApplicantMessageTemplateKey[]).map((key) =>
    buildApplicantMessageDraft(applicant, key),
  );
}

import { prisma } from "@/lib/prisma";

function cleanString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseDate(value: unknown) {
  const text = cleanString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req: Request) {
  const body = await req.json();

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();

  if (!firstName || !lastName) {
    return new Response("First name and last name are required.", { status: 400 });
  }

  const guarantor = await prisma.guarantor.create({
    data: {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim() || null,
      email: cleanString(body.email),
      phone: cleanString(body.phone),
      annualIncomePence:
        typeof body.annualIncomePence === "number" ? body.annualIncomePence : null,
      dateOfBirth: parseDate(body.dateOfBirth),
      relationshipToApplicant: cleanString(body.relationshipToApplicant),
      address1: cleanString(body.address1),
      address2: cleanString(body.address2),
      city: cleanString(body.city),
      postcode: cleanString(body.postcode),
      employmentStatus: cleanString(body.employmentStatus),
      employerName: cleanString(body.employerName),
      jobTitle: cleanString(body.jobTitle),
      notes: cleanString(body.notes),
      deedSigned: Boolean(body.deedSigned),
      deedSignedAt: body.deedSigned ? parseDate(body.deedSignedAt) ?? new Date() : null,
      applicantId: cleanString(body.applicantId),
    },
  });

  return Response.json(guarantor);
}
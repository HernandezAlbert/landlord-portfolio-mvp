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

async function getId(
  params: Promise<{ id: string }> | { id: string }
): Promise<string> {
  const resolved = "then" in params ? await params : params;
  return resolved.id;
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const id = await getId(context.params);
  const body = await req.json();

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();

  if (!firstName || !lastName) {
    return new Response("First name and last name are required.", { status: 400 });
  }

  const deedSigned = Boolean(body.deedSigned);

  const guarantor = await prisma.guarantor.update({
    where: { id },
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
      deedSigned,
      deedSignedAt: deedSigned ? parseDate(body.deedSignedAt) ?? new Date() : null,
    },
  });

  return Response.json(guarantor);
}
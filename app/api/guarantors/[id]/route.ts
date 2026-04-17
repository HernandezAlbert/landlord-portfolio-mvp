// app/api/guarantors/[id]/route.ts

import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";

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

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const currentUser = await requireSessionUser();
  const { id } = await context.params;
  const body = await req.json();

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();

  if (!firstName || !lastName) {
    return new Response("First name and last name are required.", {
      status: 400,
    });
  }

  const existing = await prisma.guarantor.findFirst({
    where: {
      id,
      archivedAt: null,
      applicant: {
        userId: currentUser.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return new Response("Guarantor not found.", { status: 404 });
  }

  const deedSigned = Boolean(body.deedSigned);

  await prisma.guarantor.updateMany({
    where: {
      id,
      applicant: {
        userId: currentUser.id,
      },
    },
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
      deedSignedAt: deedSigned
        ? parseDate(body.deedSignedAt) ?? new Date()
        : null,
    },
  });

  const guarantor = await prisma.guarantor.findFirst({
    where: {
      id,
      applicant: {
        userId: currentUser.id,
      },
    },
  });

  return Response.json(guarantor);
}
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  const guarantor = await prisma.guarantor.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      fullName: `${body.firstName} ${body.lastName}`,
      email: body.email || null,
      phone: body.phone || null,
      annualIncomePence: body.annualIncomePence ?? null,
      applicantId: body.applicantId ?? null,
    },
  });

  return Response.json(guarantor);
}
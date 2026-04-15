import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      tenancy: {
        deletedAt: null,
        property: {
          deletedAt: null,
          userId: sessionUser.id,
        },
      },
    },
    include: {
      tenancy: {
        include: {
          property: true,
        },
      },
    },
    orderBy: [{ dueDate: "asc" }],
  });

  const rows = payments.map((p) => ({
    paymentId: p.id,
    property: p.tenancy.property.name,
    tenancyId: p.tenancyId,
    dueDate: p.dueDate.toISOString().slice(0, 10),
    amountDue: p.amountDue,
    amountPaid: p.amountPaid,
    paidDate: p.paidDate ? p.paidDate.toISOString().slice(0, 10) : "",
    arrearsForLine: p.amountDue - p.amountPaid,
    method: p.method ?? "",
    notes: p.notes ?? "",
  }));

  const csv = toCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="payments.csv"',
    },
  });
}
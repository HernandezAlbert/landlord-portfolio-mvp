import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { tenancyId, dueDate, amountDue, amountPaid, paidDate, method, notes } = body;

  if (!tenancyId || !dueDate || typeof amountDue !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const payment = await prisma.payment.create({
    data: {
      tenancyId,
      dueDate: new Date(dueDate),
      amountDue,
      amountPaid: typeof amountPaid === "number" ? amountPaid : 0,
      paidDate: paidDate ? new Date(paidDate) : null,
      method: method ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ payment });
}

import { prisma } from "./prisma";

export async function getTotalArrears(asOf = new Date()) {
  const payments = await prisma.payment.findMany({
    where: {
      dueDate: { lte: asOf },
      deletedAt: null,
      tenancy: {
        isActive: true,
        deletedAt: null,
      },
    },
    select: {
      amountDue: true,
      amountPaid: true,
    },
  });

  return payments.reduce((sum, p) => {
    const paid = p.amountPaid ?? 0;
    return sum + Math.max(0, p.amountDue - paid);
  }, 0);
}

export async function getTenancyArrears(tenancyId: string, asOf = new Date()) {
  const payments = await prisma.payment.findMany({
    where: {
      tenancyId,
      deletedAt: null,
      dueDate: { lte: asOf },
    },
    select: {
      amountDue: true,
      amountPaid: true,
    },
  });

  return payments.reduce((sum, p) => {
    const paid = p.amountPaid ?? 0;
    return sum + Math.max(0, p.amountDue - paid);
  }, 0);
}

export async function isSection8Eligible(tenancyId: string, asOf = new Date()) {
  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    select: { isActive: true, rentMonthly: true },
  });

  if (!tenancy?.isActive) return false;

  const arrears = await getTenancyArrears(tenancyId, asOf);
  return arrears >= 2 * tenancy.rentMonthly;
}
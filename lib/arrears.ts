import { prisma } from "./prisma";

export async function getTotalArrears(userId: string, asOf = new Date()) {
  const payments = await prisma.payment.findMany({
    where: {
      dueDate: { lte: asOf },
      deletedAt: null,
      tenancy: {
        isActive: true,
        deletedAt: null,
        property: {
          userId,
        },
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

export async function getTenancyArrears(
  userId: string,
  tenancyId: string,
  asOf = new Date()
) {
  const payments = await prisma.payment.findMany({
    where: {
      tenancyId,
      deletedAt: null,
      dueDate: { lte: asOf },
      tenancy: {
        property: {
          userId,
        },
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

export async function isSection8Eligible(
  userId: string,
  tenancyId: string,
  asOf = new Date()
) {
  const tenancy = await prisma.tenancy.findFirst({
    where: {
      id: tenancyId,
      property: {
        userId,
      },
    },
    select: { isActive: true, rentMonthly: true },
  });

  if (!tenancy?.isActive) return false;

  const arrears = await getTenancyArrears(userId, tenancyId, asOf);
  return arrears >= 2 * tenancy.rentMonthly;
}
import { prisma } from "./prisma";

export function startOfUtcMonth(base = new Date()) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function endOfUtcMonthExclusive(base = new Date()) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

export function money(pence: number | null | undefined) {
  return `£${(((pence ?? 0) as number) / 100).toFixed(2)}`;
}

export async function getPortfolioFinanceSummary(userId: string, asOf = new Date()) {
  const monthStart = startOfUtcMonth(asOf);
  const nextMonthStart = endOfUtcMonthExclusive(asOf);

  const [
    activeTenancies,
    dueThisMonthAgg,
    receivedThisMonthAgg,
    expensesThisMonthAgg,
    activeMortgages,
    overduePayments,
  ] = await Promise.all([
    prisma.tenancy.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        property: {
          deletedAt: null,
          userId,
        },
      },
      select: { id: true, rentMonthly: true, propertyId: true },
    }),
    prisma.payment.aggregate({
      where: {
        deletedAt: null,
        tenancy: {
          deletedAt: null,
          isActive: true,
          property: {
            deletedAt: null,
            userId,
          },
        },
        dueDate: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amountDue: true, amountPaid: true },
    }),
    prisma.payment.aggregate({
      where: {
        deletedAt: null,
        tenancy: {
          deletedAt: null,
          property: {
            deletedAt: null,
            userId,
          },
        },
        paidDate: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amountPaid: true },
    }),
    prisma.expense.aggregate({
      where: {
        deletedAt: null,
        property: {
          deletedAt: null,
          userId,
        },
        date: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amount: true },
    }),
    prisma.mortgageDetail.findMany({
      where: {
        deletedAt: null,
        property: {
          deletedAt: null,
          userId,
        },
      },
      select: { monthlyPayment: true },
    }),
    prisma.payment.findMany({
      where: {
        deletedAt: null,
        dueDate: { lte: asOf },
        tenancy: {
          deletedAt: null,
          isActive: true,
          property: {
            deletedAt: null,
            userId,
          },
        },
      },
      include: {
        tenancy: { include: { property: true, tenants: { include: { tenant: true } } } },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 12,
    }),
  ]);

  const monthlyContractedRent = activeTenancies.reduce((sum, t) => sum + t.rentMonthly, 0);
  const filteredOverduePayments = overduePayments.filter((payment) => payment.amountPaid < payment.amountDue);
  const scheduledThisMonth = dueThisMonthAgg._sum.amountDue ?? 0;
  const paidAgainstDueThisMonth = dueThisMonthAgg._sum.amountPaid ?? 0;
  const cashReceivedThisMonth = receivedThisMonthAgg._sum.amountPaid ?? 0;
  const expensesThisMonth = expensesThisMonthAgg._sum.amount ?? 0;
  const monthlyMortgageCommitment = activeMortgages.reduce((sum, m) => sum + (m.monthlyPayment ?? 0), 0);
  const outstandingThisMonth = Math.max(0, scheduledThisMonth - paidAgainstDueThisMonth);
  const estimatedNetCashflow = cashReceivedThisMonth - expensesThisMonth - monthlyMortgageCommitment;

  return {
    monthStart,
    nextMonthStart,
    monthlyContractedRent,
    scheduledThisMonth,
    paidAgainstDueThisMonth,
    cashReceivedThisMonth,
    expensesThisMonth,
    monthlyMortgageCommitment,
    outstandingThisMonth,
    estimatedNetCashflow,
    activeTenancyCount: activeTenancies.length,
    overduePayments: filteredOverduePayments,
  };
}

export async function getPropertyFinanceRows(userId: string, asOf = new Date()) {
  const monthStart = startOfUtcMonth(asOf);
  const nextMonthStart = endOfUtcMonthExclusive(asOf);

  const properties = await prisma.property.findMany({
    where: {
      deletedAt: null,
      userId,
    },
    include: {
      mortgage: true,
      tenancies: {
        where: { deletedAt: null },
        include: {
          payments: { where: { deletedAt: null } },
        },
      },
      expenses: { where: { deletedAt: null, date: { gte: monthStart, lt: nextMonthStart } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return properties.map((property) => {
    const activeTenancies = property.tenancies.filter((t) => t.isActive);
    const contractedRent = activeTenancies.reduce((sum, t) => sum + t.rentMonthly, 0);
    const dueThisMonth = activeTenancies.reduce(
      (sum, t) =>
        sum +
        t.payments
          .filter((p) => p.dueDate >= monthStart && p.dueDate < nextMonthStart)
          .reduce((s, p) => s + p.amountDue, 0),
      0,
    );
    const receivedThisMonth = property.tenancies.reduce(
      (sum, t) =>
        sum +
        t.payments
          .filter((p) => p.paidDate && p.paidDate >= monthStart && p.paidDate < nextMonthStart)
          .reduce((s, p) => s + p.amountPaid, 0),
      0,
    );
    const overdue = activeTenancies.reduce(
      (sum, t) =>
        sum +
        t.payments
          .filter((p) => p.dueDate <= asOf)
          .reduce((s, p) => s + Math.max(0, p.amountDue - p.amountPaid), 0),
      0,
    );
    const expensesThisMonth = property.expenses.reduce((sum, e) => sum + e.amount, 0);
    const mortgageMonthly = property.mortgage?.monthlyPayment ?? 0;
    const annualisedRent = contractedRent * 12;
    const annualisedCosts = (expensesThisMonth + mortgageMonthly) * 12;

    return {
      id: property.id,
      name: property.name,
      contractedRent,
      dueThisMonth,
      receivedThisMonth,
      overdue,
      expensesThisMonth,
      mortgageMonthly,
      estimatedNetThisMonth: receivedThisMonth - expensesThisMonth - mortgageMonthly,
      activeTenancies: activeTenancies.length,
      simpleAnnualProfit: annualisedRent - annualisedCosts,
    };
  });
}
import { prisma } from "./prisma";

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function makeDueDate(year: number, monthZero: number, dueDay: number) {
  return new Date(Date.UTC(year, monthZero, Math.min(Math.max(dueDay, 1), 28)));
}

function addMonthsUtc(d: Date, months: number) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate())
  );
}

export function getPaymentStatus(
  amountDue: number,
  amountPaid: number,
  dueDate: Date,
  asOf = new Date()
) {
  if (amountPaid >= amountDue) return "PAID";
  if (amountPaid > 0) return dueDate <= asOf ? "PART PAID / LATE" : "PART PAID";
  return dueDate <= asOf ? "UNPAID / LATE" : "UPCOMING";
}

export async function ensureRentScheduleForTenancy(
  userId: string,
  tenancyId: string,
  asOf = new Date()
) {
  const tenancy = await prisma.tenancy.findFirst({
    where: {
      id: tenancyId,
      deletedAt: null,
      property: {
        userId,
        deletedAt: null,
      },
    },
    include: {
      payments: {
        where: { deletedAt: null },
        orderBy: { dueDate: "desc" },
        take: 1,
      },
    },
  });

  if (!tenancy || !tenancy.isActive || !tenancy.autoGenerateRent) {
    return { created: 0, tenancy: null as any };
  }

  const monthsAhead = Math.min(Math.max(tenancy.rentGenerateMonthsAhead || 3, 1), 24);
  const dueDay = Math.min(Math.max(tenancy.rentDueDay, 1), 28);
  const today = startOfUtcDay(asOf);
  const tenancyStart = startOfUtcDay(tenancy.startDate);

  const horizon = makeDueDate(
    today.getUTCFullYear(),
    today.getUTCMonth() + monthsAhead,
    dueDay
  );

  let base = tenancy.payments[0]?.dueDate
    ? addMonthsUtc(startOfUtcDay(tenancy.payments[0].dueDate), 1)
    : makeDueDate(tenancyStart.getUTCFullYear(), tenancyStart.getUTCMonth(), dueDay);

  while (base < tenancyStart) {
    base = addMonthsUtc(base, 1);
  }

  const currentMonthDue = makeDueDate(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    dueDay
  );

  let cursor = base < currentMonthDue ? currentMonthDue : base;

  while (cursor < tenancyStart) {
    cursor = addMonthsUtc(cursor, 1);
  }

  const dueDates: Date[] = [];
  while (cursor <= horizon) {
    dueDates.push(cursor);
    cursor = addMonthsUtc(cursor, 1);
  }

  if (!dueDates.length) {
    await prisma.tenancy.updateMany({
      where: { id: tenancy.id },
      data: { lastRentGeneratedOn: new Date() },
    });

    return { created: 0, tenancy };
  }

  const existing = await prisma.payment.findMany({
    where: {
      tenancyId: tenancy.id,
      deletedAt: null,
      dueDate: { in: dueDates },
    },
    select: { dueDate: true },
  });

  const existingKeys = new Set(
    existing.map((x) => x.dueDate.toISOString().slice(0, 10))
  );

  const rows = dueDates
    .filter((d) => !existingKeys.has(d.toISOString().slice(0, 10)))
    .map((d) => ({
      tenancyId: tenancy.id,
      dueDate: d,
      amountDue: tenancy.rentMonthly,
      amountPaid: 0,
    }));

  if (rows.length) {
    await prisma.payment.createMany({ data: rows });
  }

  await prisma.tenancy.updateMany({
    where: { id: tenancy.id },
    data: { lastRentGeneratedOn: new Date() },
  });

  return { created: rows.length, tenancy };
}

export async function ensureRentSchedulesForAllActiveTenancies(
  userId: string,
  asOf = new Date()
) {
  const ids = await prisma.tenancy.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      autoGenerateRent: true,
      property: {
        userId,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  let created = 0;
  for (const t of ids) {
    const res = await ensureRentScheduleForTenancy(userId, t.id, asOf);
    created += res.created;
  }

  return { tenanciesProcessed: ids.length, paymentsCreated: created };
}
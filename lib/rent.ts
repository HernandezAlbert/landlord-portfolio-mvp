import { prisma } from "./prisma";
import { getRentAmountPence, getRentFrequency } from "./tenancy-rent";

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysInUtcMonth(year: number, monthZero: number) {
  return new Date(Date.UTC(year, monthZero + 1, 0)).getUTCDate();
}

function addMonthsAnchoredUtc(anchorDate: Date, monthsFromAnchor: number) {
  const year = anchorDate.getUTCFullYear();
  const month = anchorDate.getUTCMonth();
  const day = anchorDate.getUTCDate();
  const targetYear = year + Math.floor((month + monthsFromAnchor) / 12);
  const targetMonth = (month + monthsFromAnchor) % 12;
  const normalizedTargetMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
  const normalizedTargetYear = targetMonth < 0 ? targetYear - 1 : targetYear;
  const maxDay = daysInUtcMonth(normalizedTargetYear, normalizedTargetMonth);

  return new Date(
    Date.UTC(normalizedTargetYear, normalizedTargetMonth, Math.min(day, maxDay))
  );
}

function addDaysUtc(d: Date, days: number) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days)
  );
}

function buildDueDates(
  tenancyStart: Date,
  frequency: "WEEKLY" | "MONTHLY",
  asOf: Date,
  monthsAhead: number,
  latestExistingDueDate?: Date | null
) {
  const today = startOfUtcDay(asOf);
  const dueDates: Date[] = [];

  const minDate = latestExistingDueDate
    ? addDaysUtc(startOfUtcDay(latestExistingDueDate), 1)
    : today;

  if (frequency === "WEEKLY") {
    const horizon = addDaysUtc(today, monthsAhead * 31);

    let cursor = tenancyStart;

    while (cursor < minDate) {
      cursor = addDaysUtc(cursor, 7);
    }

    while (cursor <= horizon) {
      dueDates.push(cursor);
      cursor = addDaysUtc(cursor, 7);
    }

    return dueDates;
  }

  const horizon = addMonthsAnchoredUtc(today, monthsAhead);

  let monthOffset = 0;
  let cursor = addMonthsAnchoredUtc(tenancyStart, monthOffset);

  while (cursor < minDate) {
    monthOffset += 1;
    cursor = addMonthsAnchoredUtc(tenancyStart, monthOffset);
  }

  while (cursor <= horizon) {
    dueDates.push(cursor);
    monthOffset += 1;
    cursor = addMonthsAnchoredUtc(tenancyStart, monthOffset);
  }

  return dueDates;
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
  const today = startOfUtcDay(asOf);
  const tenancyStart = startOfUtcDay(tenancy.startDate);
  const frequency = getRentFrequency(tenancy);
  const amountDue = getRentAmountPence(tenancy);

  await prisma.payment.deleteMany({
    where: {
      tenancyId: tenancy.id,
      deletedAt: null,
      amountPaid: 0,
      dueDate: {
        gt: today,
      },
    },
  });

  const latestRemainingPayment = await prisma.payment.findFirst({
    where: {
      tenancyId: tenancy.id,
      deletedAt: null,
    },
    orderBy: { dueDate: "desc" },
    select: { dueDate: true },
  });

  const dueDates = buildDueDates(
    tenancyStart,
    frequency,
    today,
    monthsAhead,
    latestRemainingPayment?.dueDate ?? null
  );

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
      amountDue,
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

export async function recalcFromPayment(userId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      deletedAt: null,
      tenancy: {
        deletedAt: null,
        property: {
          userId,
          deletedAt: null,
        },
      },
    },
    include: {
      tenancy: true,
    },
  });

  if (!payment || !payment.tenancy) return { recreated: 0 };

  const tenancy = payment.tenancy;
  const frequency = getRentFrequency(tenancy);
  const amountDue = getRentAmountPence(tenancy);
  const anchorDate = startOfUtcDay(payment.dueDate);
  const monthsAhead = Math.min(Math.max(tenancy.rentGenerateMonthsAhead || 3, 1), 24);

  await prisma.payment.deleteMany({
    where: {
      tenancyId: tenancy.id,
      deletedAt: null,
      amountPaid: 0,
      dueDate: {
        gt: anchorDate,
      },
    },
  });

  const futureDates: Date[] = [];

  if (frequency === "WEEKLY") {
    const horizon = addDaysUtc(anchorDate, monthsAhead * 31);
    let cursor = addDaysUtc(anchorDate, 7);

    while (cursor <= horizon) {
      futureDates.push(cursor);
      cursor = addDaysUtc(cursor, 7);
    }
  } else {
    const horizon = addMonthsAnchoredUtc(anchorDate, monthsAhead);
    let offset = 1;
    let cursor = addMonthsAnchoredUtc(anchorDate, offset);

    while (cursor <= horizon) {
      futureDates.push(cursor);
      offset += 1;
      cursor = addMonthsAnchoredUtc(anchorDate, offset);
    }
  }

  if (!futureDates.length) {
    return { recreated: 0 };
  }

  const existing = await prisma.payment.findMany({
    where: {
      tenancyId: tenancy.id,
      deletedAt: null,
      dueDate: { in: futureDates },
    },
    select: { dueDate: true },
  });

  const existingKeys = new Set(
    existing.map((x) => x.dueDate.toISOString().slice(0, 10))
  );

  const rows = futureDates
    .filter((d) => !existingKeys.has(d.toISOString().slice(0, 10)))
    .map((d) => ({
      tenancyId: tenancy.id,
      dueDate: d,
      amountDue,
      amountPaid: 0,
    }));

  if (rows.length) {
    await prisma.payment.createMany({ data: rows });
  }

  await prisma.tenancy.updateMany({
    where: { id: tenancy.id },
    data: { lastRentGeneratedOn: new Date() },
  });

  return { recreated: rows.length };
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

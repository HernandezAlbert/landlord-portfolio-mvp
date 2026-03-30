import { ExpenseCategory, ReportStatus, ReportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ReportPeriod = {
  start: Date;
  end: Date;
  dueDate: Date;
  title: string;
  label: string;
  yearStart: number;
  quarter?: number;
};

const expenseLabels: Record<ExpenseCategory, string> = {
  REPAIRS: "Repairs",
  MAINTENANCE: "Maintenance",
  INSURANCE: "Insurance",
  UTILITIES: "Utilities",
  MORTGAGE_INTEREST: "Mortgage interest",
  SERVICE_CHARGE: "Service charge",
  MANAGEMENT: "Management",
  FEES: "Fees",
  OTHER: "Other",
};

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function getTaxYearRange(yearStart: number) {
  return {
    start: new Date(Date.UTC(yearStart, 3, 6, 0, 0, 0, 0)),
    end: new Date(Date.UTC(yearStart + 1, 3, 5, 23, 59, 59, 999)),
    dueDate: new Date(Date.UTC(yearStart + 1, 0, 31, 0, 0, 0, 0)),
    label: `${yearStart}/${String(yearStart + 1).slice(-2)}`,
  };
}

export function getQuarterPeriods(yearStart: number): ReportPeriod[] {
  const label = `${yearStart}/${String(yearStart + 1).slice(-2)}`;

  return [
    {
      start: new Date(Date.UTC(yearStart, 3, 6)),
      end: new Date(Date.UTC(yearStart, 6, 5, 23, 59, 59, 999)),
      dueDate: new Date(Date.UTC(yearStart, 7, 7)),
      quarter: 1,
      yearStart,
      title: `Q1 ${label}`,
      label,
    },
    {
      start: new Date(Date.UTC(yearStart, 6, 6)),
      end: new Date(Date.UTC(yearStart, 9, 5, 23, 59, 59, 999)),
      dueDate: new Date(Date.UTC(yearStart, 10, 7)),
      quarter: 2,
      yearStart,
      title: `Q2 ${label}`,
      label,
    },
    {
      start: new Date(Date.UTC(yearStart, 9, 6)),
      end: new Date(Date.UTC(yearStart + 1, 0, 5, 23, 59, 59, 999)),
      dueDate: new Date(Date.UTC(yearStart + 1, 1, 7)),
      quarter: 3,
      yearStart,
      title: `Q3 ${label}`,
      label,
    },
    {
      start: new Date(Date.UTC(yearStart + 1, 0, 6)),
      end: new Date(Date.UTC(yearStart + 1, 3, 5, 23, 59, 59, 999)),
      dueDate: new Date(Date.UTC(yearStart + 1, 4, 7)),
      quarter: 4,
      yearStart,
      title: `Q4 ${label}`,
      label,
    },
  ];
}

export function getAnnualPeriod(yearStart: number): ReportPeriod {
  const range = getTaxYearRange(yearStart);
  return {
    start: range.start,
    end: range.end,
    dueDate: range.dueDate,
    title: `Annual ${range.label}`,
    label: range.label,
    yearStart,
  };
}

export function getReportPeriod(type: ReportType, yearStart: number, quarter?: number | null): ReportPeriod {
  if (type === "ANNUAL") return getAnnualPeriod(yearStart);
  const periods = getQuarterPeriods(yearStart);
  const match = periods.find((item) => item.quarter === Number(quarter || 1));
  if (!match) throw new Error("Invalid quarter");
  return match;
}

export function getCurrentTaxYearStart(base = new Date()) {
  const utcYear = base.getUTCFullYear();
  const taxYearStart = new Date(Date.UTC(utcYear, 3, 6));
  return base >= taxYearStart ? utcYear : utcYear - 1;
}

export function getReminderDays(csv: string | null | undefined) {
  return String(csv || "14,7,3,1")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => b - a);
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function diffInDays(a: Date, b: Date) {
  const ms = startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime();
  return Math.round(ms / 86400000);
}

export async function generateReportDataset({
  start,
  end,
  propertyId,
}: {
  start: Date;
  end: Date;
  propertyId?: string | null;
}) {
  const [payments, expenses, property] = await Promise.all([
    prisma.payment.findMany({
      where: {
        deletedAt: null,
        paidDate: { gte: start, lte: end },
        amountPaid: { gt: 0 },
        tenancy: {
          deletedAt: null,
          property: {
            deletedAt: null,
            ...(propertyId ? { id: propertyId } : {}),
          },
        },
      },
      include: {
        tenancy: {
          include: {
            property: { select: { name: true } },
            tenants: { include: { tenant: { select: { fullName: true } } } },
          },
        },
      },
      orderBy: [{ paidDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.expense.findMany({
      where: {
        deletedAt: null,
        date: { gte: start, lte: end },
        property: { deletedAt: null, ...(propertyId ? { id: propertyId } : {}) },
      },
      include: {
        property: { select: { name: true } },
        tenancy: { include: { tenants: { include: { tenant: { select: { fullName: true } } } } } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    propertyId ? prisma.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { name: true } }) : Promise.resolve(null),
  ]);

  const incomeRows = payments.map((payment) => ({
    date: formatDate(payment.paidDate),
    property: payment.tenancy.property.name,
    type: "Income",
    category: "Rent",
    description: payment.notes?.trim() || `Rent received${payment.method ? ` via ${payment.method}` : ""}`,
    notes: payment.notes?.trim() || "",
    amountPence: payment.amountPaid,
    amount: (payment.amountPaid / 100).toFixed(2),
    tenancy: payment.tenancy.tenants.map((tt) => tt.tenant.fullName).join(", "),
    sourceId: payment.id,
    sourceType: "payment",
    reference: payment.method || "",
  }));

  const expenseRows = expenses.map((expense) => ({
    date: formatDate(expense.date),
    property: expense.property.name,
    type: "Expense",
    category: expenseLabels[expense.category] || expense.category,
    description: expense.notes?.trim() || expense.vendor?.trim() || expense.reference?.trim() || "Expense",
    notes: expense.notes?.trim() || "",
    amountPence: -expense.amount,
    amount: `-${(expense.amount / 100).toFixed(2)}`,
    tenancy: expense.tenancy?.tenants.map((tt) => tt.tenant.fullName).join(", ") || "",
    sourceId: expense.id,
    sourceType: "expense",
    reference: expense.reference || expense.vendor || "",
  }));

  const rows = [...incomeRows, ...expenseRows].sort((a, b) => {
    const left = `${a.date}-${a.type}-${a.sourceId}`;
    const right = `${b.date}-${b.type}-${b.sourceId}`;
    return left.localeCompare(right);
  });

  const totalIncome = incomeRows.reduce((sum, row) => sum + row.amountPence, 0);
  const totalExpenses = Math.abs(expenseRows.reduce((sum, row) => sum + row.amountPence, 0));

  const categoryTotals = Object.entries(
    expenseRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + Math.abs(row.amountPence);
      return acc;
    }, {})
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, amountPence]) => ({
      category,
      amountPence,
      amount: (amountPence / 100).toFixed(2),
    }));

  const propertyTotals = Object.entries(
    rows.reduce<Record<string, { income: number; expenses: number }>>((acc, row) => {
      acc[row.property] ||= { income: 0, expenses: 0 };
      if (row.type === "Income") acc[row.property].income += row.amountPence;
      else acc[row.property].expenses += Math.abs(row.amountPence);
      return acc;
    }, {})
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([propertyName, totals]) => ({
      property: propertyName,
      incomePence: totals.income,
      expensesPence: totals.expenses,
      netPence: totals.income - totals.expenses,
      income: (totals.income / 100).toFixed(2),
      expenses: (totals.expenses / 100).toFixed(2),
      net: ((totals.income - totals.expenses) / 100).toFixed(2),
    }));

  const warnings: string[] = [];
  if (!rows.length) warnings.push("No income or expenses were found for this period.");
  if (expenseRows.some((row) => row.category === "Other")) warnings.push("Some expenses are in the Other category. Review before sending to your accountant.");
  if (rows.some((row) => !row.description)) warnings.push("Some lines are missing descriptions.");

  return {
    summary: {
      propertyScope: property?.name || "All properties",
      periodStart: formatDate(start),
      periodEnd: formatDate(end),
      totalIncomePence: totalIncome,
      totalExpensesPence: totalExpenses,
      netPence: totalIncome - totalExpenses,
      totalIncome: (totalIncome / 100).toFixed(2),
      totalExpenses: (totalExpenses / 100).toFixed(2),
      net: ((totalIncome - totalExpenses) / 100).toFixed(2),
      lineCount: rows.length,
    },
    propertyTotals,
    categoryTotals,
    rows,
    warnings,
  };
}

export async function createReportRun({
  type,
  yearStart,
  quarter,
  propertyId,
  generatedBy,
}: {
  type: ReportType;
  yearStart: number;
  quarter?: number | null;
  propertyId?: string | null;
  generatedBy: "manual" | "system";
}) {
  const period = getReportPeriod(type, yearStart, quarter);
  const dataset = await generateReportDataset({ start: period.start, end: period.end, propertyId });

  const run = await prisma.reportRun.create({
    data: {
      type,
      propertyId: propertyId || null,
      periodStart: period.start,
      periodEnd: period.end,
      dueDate: period.dueDate,
      generatedBy,
      status: dataset.warnings.length ? ReportStatus.NEEDS_REVIEW : ReportStatus.DRAFT,
      snapshots: {
        create: {
          summaryJson: dataset.summary,
          rowsJson: dataset.rows,
          warningsJson: {
            items: dataset.warnings,
            propertyTotals: dataset.propertyTotals,
            categoryTotals: dataset.categoryTotals,
          },
        },
      },
    },
    include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 }, property: { select: { name: true } } },
  });

  return { run, dataset, period };
}

export async function getLatestSnapshot(reportRunId: string) {
  return prisma.reportSnapshot.findFirst({
    where: { reportRunId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReportingDashboardData(options?: {
  status?: ReportStatus | "ALL";
  limit?: number;
}) {
  const now = new Date();
  const currentTaxYearStart = getCurrentTaxYearStart(now);
  const status = options?.status && options.status !== "ALL" ? options.status : undefined;
  const limit = Math.max(6, Math.min(60, options?.limit ?? 12));

  const [properties, schedules, runs] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.reportSchedule.findMany({
      include: { property: { select: { id: true, name: true } } },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
      take: 20,
    }),
    prisma.reportRun.findMany({
      where: status ? { status } : undefined,
      select: {
        id: true,
        type: true,
        property: { select: { name: true } },
        periodStart: true,
        periodEnd: true,
        dueDate: true,
        status: true,
        generatedBy: true,
        generatedAt: true,
        finalisedAt: true,
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            summaryJson: true,
            warningsJson: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ generatedAt: "desc" }],
      take: limit,
    }),
  ]);

  const counts = await prisma.reportRun.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  return {
    currentTaxYearStart,
    availableYears: Array.from({ length: 5 }, (_, i) => currentTaxYearStart - i),
    properties,
    schedules,
    runs,
    limit,
    selectedStatus: options?.status ?? "ALL",
    counts: {
      ALL: counts.reduce((sum, item) => sum + item._count._all, 0),
      DRAFT: counts.find((item) => item.status === "DRAFT")?._count._all ?? 0,
      NEEDS_REVIEW: counts.find((item) => item.status === "NEEDS_REVIEW")?._count._all ?? 0,
      READY: counts.find((item) => item.status === "READY")?._count._all ?? 0,
      EXPORTED: counts.find((item) => item.status === "EXPORTED")?._count._all ?? 0,
    },
  };
}

export async function ensureScheduledReports(today = new Date()) {
  const schedules = await prisma.reportSchedule.findMany({
    where: { isActive: true, autoGenerate: true },
    include: { property: { select: { name: true } } },
  });

  const created: Array<{ scheduleId: string; reportRunId: string; title: string }> = [];

  for (const schedule of schedules) {
    const targetYears = [getCurrentTaxYearStart(today), getCurrentTaxYearStart(today) - 1];

    for (const yearStart of targetYears) {
      const periods = schedule.type === ReportType.ANNUAL ? [getAnnualPeriod(yearStart)] : getQuarterPeriods(yearStart);

      for (const period of periods) {
        const daysUntilDue = diffInDays(period.dueDate, today);
        if (daysUntilDue !== schedule.daysBeforeDue) continue;

        const existing = await prisma.reportRun.findFirst({
          where: {
            type: schedule.type,
            propertyId: schedule.propertyId,
            periodStart: period.start,
            periodEnd: period.end,
          },
          select: { id: true },
        });

        if (existing) continue;

        const { run } = await createReportRun({
          type: schedule.type,
          yearStart,
          quarter: period.quarter,
          propertyId: schedule.propertyId,
          generatedBy: "system",
        });

        created.push({
          scheduleId: schedule.id,
          reportRunId: run.id,
          title: period.title,
        });
      }
    }
  }

  return created;
}

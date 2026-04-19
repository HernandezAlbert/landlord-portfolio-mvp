import { ExpenseCategory, ReportStatus, ReportType, Prisma } from "@prisma/client";
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

type SnapshotSummary = {
  ownerUserId?: string;
  propertyScope?: string;
  periodStart?: string;
  periodEnd?: string;
  totalIncome?: string;
  totalExpenses?: string;
  net?: string;
  lineCount?: number;
};

type SnapshotWarnings = {
  ownerUserId?: string;
  items?: string[];
  propertyTotals?: Array<{
    property: string;
    incomePence: number;
    expensesPence: number;
    netPence: number;
    income: string;
    expenses: string;
    net: string;
  }>;
  categoryTotals?: Array<{
    category: string;
    amountPence: number;
    amount: string;
  }>;
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

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getSnapshotOwnerUserId(
  summaryJson: Prisma.JsonValue | null | undefined,
  warningsJson: Prisma.JsonValue | null | undefined
) {
  const summary = asObject(summaryJson);
  if (typeof summary?.ownerUserId === "string" && summary.ownerUserId.trim()) {
    return summary.ownerUserId;
  }

  const warnings = asObject(warningsJson);
  if (typeof warnings?.ownerUserId === "string" && warnings.ownerUserId.trim()) {
    return warnings.ownerUserId;
  }

  return null;
}

function getSummaryJson(
  summaryJson: Prisma.JsonValue | null | undefined
): SnapshotSummary | null {
  const summary = asObject(summaryJson);
  if (!summary) return null;
  return {
    ownerUserId:
      typeof summary.ownerUserId === "string" ? summary.ownerUserId : undefined,
    propertyScope:
      typeof summary.propertyScope === "string" ? summary.propertyScope : undefined,
    periodStart:
      typeof summary.periodStart === "string" ? summary.periodStart : undefined,
    periodEnd: typeof summary.periodEnd === "string" ? summary.periodEnd : undefined,
    totalIncome:
      typeof summary.totalIncome === "string" ? summary.totalIncome : undefined,
    totalExpenses:
      typeof summary.totalExpenses === "string" ? summary.totalExpenses : undefined,
    net: typeof summary.net === "string" ? summary.net : undefined,
    lineCount:
      typeof summary.lineCount === "number" ? summary.lineCount : undefined,
  };
}

function getWarningsJson(
  warningsJson: Prisma.JsonValue | null | undefined
): SnapshotWarnings | null {
  const warnings = asObject(warningsJson);
  if (!warnings) return null;

  return {
    ownerUserId:
      typeof warnings.ownerUserId === "string" ? warnings.ownerUserId : undefined,
    items: Array.isArray(warnings.items)
      ? warnings.items.filter((item): item is string => typeof item === "string")
      : [],
    propertyTotals: Array.isArray(warnings.propertyTotals)
      ? (warnings.propertyTotals as SnapshotWarnings["propertyTotals"])
      : [],
    categoryTotals: Array.isArray(warnings.categoryTotals)
      ? (warnings.categoryTotals as SnapshotWarnings["categoryTotals"])
      : [],
  };
}

function reportRunBelongsToUser(
  run: {
    propertyId: string | null;
    property: { name: string } | null;
    snapshots?: Array<{
      summaryJson: Prisma.JsonValue;
      warningsJson: Prisma.JsonValue;
      createdAt: Date;
    }>;
  },
  userId: string
) {
  if (run.propertyId && run.property) return true;

  const latestSnapshot = run.snapshots?.[0];
  if (!latestSnapshot) return false;

  const ownerUserId = getSnapshotOwnerUserId(
    latestSnapshot.summaryJson,
    latestSnapshot.warningsJson
  );

  return ownerUserId === userId;
}

const expenseCategoryOrder: ExpenseCategory[] = [
  "REPAIRS",
  "MAINTENANCE",
  "INSURANCE",
  "UTILITIES",
  "MORTGAGE_INTEREST",
  "SERVICE_CHARGE",
  "MANAGEMENT",
  "FEES",
  "OTHER",
];

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

export function getReportPeriod(
  type: ReportType,
  yearStart: number,
  quarter?: number | null
): ReportPeriod {
  if (type === "ANNUAL") return getAnnualPeriod(yearStart);

  const periods = getQuarterPeriods(yearStart);
  const match = periods.find((item) => item.quarter === Number(quarter || 1));

  if (!match) throw new Error("Invalid quarter.");
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
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

export function diffInDays(a: Date, b: Date) {
  const ms = startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

export async function generateReportDataset({
  userId,
  start,
  end,
  propertyId,
}: {
  userId: string;
  start: Date;
  end: Date;
  propertyId?: string | null;
}) {
  if (propertyId) {
    const ownedProperty = await prisma.property.findFirst({
      where: {
        id: propertyId,
        userId,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (!ownedProperty) {
      throw new Error("Property not found.");
    }
  }

  const [payments, expenses, property] = await Promise.all([
    prisma.payment.findMany({
      where: {
        deletedAt: null,
        amountPaid: { gt: 0 },
        paidDate: { gte: start, lte: end },
        tenancy: {
          deletedAt: null,
          property: {
            userId,
            deletedAt: null,
            ...(propertyId ? { id: propertyId } : {}),
          },
        },
      },
      include: {
        tenancy: {
          include: {
            property: { select: { name: true } },
            tenants: {
              include: {
                tenant: { select: { fullName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ paidDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.expense.findMany({
      where: {
        deletedAt: null,
        date: { gte: start, lte: end },
        property: {
          userId,
          deletedAt: null,
          ...(propertyId ? { id: propertyId } : {}),
        },
      },
      include: {
        property: { select: { name: true } },
        tenancy: {
          include: {
            tenants: {
              include: {
                tenant: { select: { fullName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    propertyId
      ? prisma.property.findFirst({
          where: {
            id: propertyId,
            userId,
            deletedAt: null,
          },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  const incomeRows = payments.map((payment) => ({
    date: formatDate(payment.paidDate),
    property: payment.tenancy.property.name,
    type: "Income" as const,
    category: "Rent",
    description:
      payment.notes?.trim() ||
      `Rent received${payment.method ? ` via ${payment.method}` : ""}`,
    notes: payment.notes?.trim() || "",
    amountPence: payment.amountPaid,
    amount: (payment.amountPaid / 100).toFixed(2),
    tenancy: payment.tenancy.tenants.map((tt) => tt.tenant.fullName).join(", "),
    sourceId: payment.id,
    sourceType: "payment" as const,
    reference: payment.method || "",
  }));

  const expenseRows = expenses.map((expense) => ({
    date: formatDate(expense.date),
    property: expense.property.name,
    type: "Expense" as const,
    category: expenseLabels[expense.category] || expense.category,
    description:
      expense.notes?.trim() ||
      expense.vendor?.trim() ||
      expense.reference?.trim() ||
      "Expense",
    notes: expense.notes?.trim() || "",
    amountPence: -expense.amount,
    amount: `-${(expense.amount / 100).toFixed(2)}`,
    tenancy:
      expense.tenancy?.tenants.map((tt) => tt.tenant.fullName).join(", ") || "",
    sourceId: expense.id,
    sourceType: "expense" as const,
    reference: expense.reference || expense.vendor || "",
  }));

  const rows = [...incomeRows, ...expenseRows].sort((a, b) => {
    const leftDate = new Date(a.date.split("/").reverse().join("-")).getTime();
    const rightDate = new Date(b.date.split("/").reverse().join("-")).getTime();
    if (leftDate !== rightDate) return leftDate - rightDate;
    return `${a.type}-${a.sourceId}`.localeCompare(`${b.type}-${b.sourceId}`);
  });

  const totalIncome = incomeRows.reduce((sum, row) => sum + row.amountPence, 0);
  const totalExpenses = Math.abs(
    expenseRows.reduce((sum, row) => sum + row.amountPence, 0)
  );

  const categoryTotals = expenseCategoryOrder
    .map((category) => {
      const amountPence = expenses
        .filter((expense) => expense.category === category)
        .reduce((sum, expense) => sum + expense.amount, 0);

      return {
        category: expenseLabels[category],
        amountPence,
        amount: (amountPence / 100).toFixed(2),
      };
    })
    .filter((item) => item.amountPence > 0);

  const propertyTotals = Object.entries(
    rows.reduce<Record<string, { income: number; expenses: number }>>(
      (acc, row) => {
        acc[row.property] ||= { income: 0, expenses: 0 };

        if (row.type === "Income") {
          acc[row.property].income += row.amountPence;
        } else {
          acc[row.property].expenses += Math.abs(row.amountPence);
        }

        return acc;
      },
      {}
    )
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

  if (!rows.length) {
    warnings.push("No income or expenses were found for this period.");
  }

  if (expenseRows.some((row) => row.category === "Other")) {
    warnings.push(
      "Some expenses are in the Other category. Review before sending to your accountant."
    );
  }

  if (rows.some((row) => !row.description)) {
    warnings.push("Some lines are missing descriptions.");
  }

  return {
    summary: {
      ownerUserId: userId,
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
  userId,
  type,
  yearStart,
  quarter,
  propertyId,
  generatedBy,
}: {
  userId: string;
  type: ReportType;
  yearStart: number;
  quarter?: number | null;
  propertyId?: string | null;
  generatedBy: "manual" | "system";
}) {
  if (propertyId) {
    const ownedProperty = await prisma.property.findFirst({
      where: {
        id: propertyId,
        userId,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (!ownedProperty) {
      throw new Error("Property not found.");
    }
  }

  const period = getReportPeriod(type, yearStart, quarter);

  const dataset = await generateReportDataset({
    userId,
    start: period.start,
    end: period.end,
    propertyId,
  });

  const run = await prisma.reportRun.create({
    data: {
      type,
      propertyId: propertyId || null,
      periodStart: period.start,
      periodEnd: period.end,
      dueDate: period.dueDate,
      generatedBy,
      status: dataset.warnings.length
        ? ReportStatus.NEEDS_REVIEW
        : ReportStatus.DRAFT,
      snapshots: {
        create: {
          summaryJson: dataset.summary,
          rowsJson: dataset.rows,
          warningsJson: {
            ownerUserId: userId,
            items: dataset.warnings,
            propertyTotals: dataset.propertyTotals,
            categoryTotals: dataset.categoryTotals,
          },
        },
      },
    },
    include: {
      property: { select: { name: true } },
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return { run, dataset, period };
}

export async function getLatestSnapshot(reportRunId: string, userId: string) {
  const run = await prisma.reportRun.findFirst({
    where: {
      id: reportRunId,
      OR: [
        { property: { userId, deletedAt: null } },
        { propertyId: null },
      ],
    },
    include: {
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      property: { select: { name: true } },
    },
  });

  if (!run) return null;
  if (!reportRunBelongsToUser(run, userId)) return null;

  return run.snapshots[0] || null;
}

export async function getReportingDashboardData(
  userId: string,
  options?: { status?: ReportStatus | "ALL"; limit?: number }
) {
  const now = new Date();
  const currentTaxYearStart = getCurrentTaxYearStart(now);
  const selectedStatus =
    options?.status && options.status !== "ALL" ? options.status : "ALL";
  const limit = Math.max(6, Math.min(60, options?.limit ?? 12));

  const [properties, schedules, rawRuns] = await Promise.all([
    prisma.property.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.reportSchedule.findMany({
      where: {
        property: {
          userId,
          deletedAt: null,
        },
      },
      include: {
        property: { select: { id: true, name: true } },
      },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
      take: 20,
    }),
    prisma.reportRun.findMany({
      where: {
        OR: [
          { property: { userId, deletedAt: null } },
          { propertyId: null },
        ],
      },
      select: {
        id: true,
        type: true,
        propertyId: true,
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
      take: 200,
    }),
  ]);

  const runs = rawRuns
    .filter((run) => reportRunBelongsToUser(run, userId))
    .filter((run) => (selectedStatus === "ALL" ? true : run.status === selectedStatus))
    .slice(0, limit)
    .map((run) => ({
      ...run,
      snapshots: run.snapshots.map((snapshot) => ({
        ...snapshot,
        summaryJson: getSummaryJson(snapshot.summaryJson),
        warningsJson: getWarningsJson(snapshot.warningsJson),
      })),
    }));

  const countsSource = rawRuns.filter((run) => reportRunBelongsToUser(run, userId));

  const counts = {
    ALL: countsSource.length,
    DRAFT: countsSource.filter((run) => run.status === "DRAFT").length,
    NEEDS_REVIEW: countsSource.filter((run) => run.status === "NEEDS_REVIEW").length,
    READY: countsSource.filter((run) => run.status === "READY").length,
    EXPORTED: countsSource.filter((run) => run.status === "EXPORTED").length,
  };

  return {
    currentTaxYearStart,
    availableYears: Array.from({ length: 5 }, (_, i) => currentTaxYearStart - i),
    properties,
    schedules,
    runs,
    limit,
    selectedStatus,
    counts,
  };
}

export async function ensureScheduledReports(today = new Date()) {
  const schedules = await prisma.reportSchedule.findMany({
    where: {
      isActive: true,
      autoGenerate: true,
      propertyId: { not: null },
      property: { deletedAt: null },
    },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          userId: true,
        },
      },
    },
  });

  const created: Array<{
    scheduleId: string;
    reportRunId: string;
    title: string;
  }> = [];

  for (const schedule of schedules) {
    if (!schedule.property?.userId) continue;

    const targetYears = [
      getCurrentTaxYearStart(today),
      getCurrentTaxYearStart(today) - 1,
    ];

    for (const yearStart of targetYears) {
      const periods =
        schedule.type === ReportType.ANNUAL
          ? [getAnnualPeriod(yearStart)]
          : getQuarterPeriods(yearStart);

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
          userId: schedule.property.userId,
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
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";

type LegacyExport = {
  exportedAt: string;
  version: string;
  counts: Record<string, number>;
  data: {
    users: LegacyUser[];
    properties: LegacyProperty[];
    tenants: LegacyTenant[];
    tenancies: LegacyTenancy[];
    tenancyTenants: LegacyTenancyTenant[];
    payments: LegacyPayment[];
    expenses: LegacyExpense[];
    complianceItems: LegacyComplianceItem[];
    inspections: LegacyInspection[];
    insurancePolicies: LegacyInsurancePolicy[];
    mortgages: LegacyMortgageDetail[];
    notices: LegacyNotice[];
    applicants: LegacyApplicant[];
    referencingChecks: LegacyReferencingCheck[];
    guarantors: LegacyGuarantor[];
    holdingDeposits: LegacyHoldingDeposit[];
    contactLogs: LegacyContactLog[];
  };
};

type LegacyUser = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

type LegacyProperty = {
  id: string;
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  postcode: string;
  notes: string | null;
  googleFormImportEnabled: boolean;
  googleSheetId: string | null;
  googleSheetTabName: string | null;
  googleLastImportedRow: number | null;
  googleLastCheckedAt: string | null;
  googleLastImportedAt: string | null;
  googleSyncError: string | null;
  screeningPassMultiplier: number;
  screeningGuarantorMinMultiplier: number;
  advertisedRentMonthly: number | null;
  propertyLicenseExpiresOn: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type LegacyTenant = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  rightToRentExpiresOn: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type LegacyTenancy = {
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string | null;
  rentMonthly: number;
  rentDueDay: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  autoGenerateRent: boolean;
  lastRentGeneratedOn: string | null;
  rentGenerateMonthsAhead: number;
};

type LegacyTenancyTenant = {
  tenancyId: string;
  tenantId: string;
  role: string | null;
  createdAt: string;
};

type LegacyPayment = {
  id: string;
  tenancyId: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  paidDate: string | null;
  method: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type LegacyExpense = {
  id: string;
  propertyId: string;
  tenancyId: string | null;
  date: string;
  amount: number;
  category: string;
  vendor: string | null;
  reference: string | null;
  notes: string | null;
  receiptPath: string | null;
  receiptStoragePath: string | null;
  receiptOriginalName: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type LegacyComplianceItem = {
  id: string;
  propertyId: string;
  type: string;
  lastDone: string | null;
  expiresOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type LegacyInspection = {
  id: string;
  propertyId: string;
  lastDate: string | null;
  nextDue: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type LegacyInsurancePolicy = {
  id: string;
  propertyId: string;
  provider: string | null;
  policyNumber: string | null;
  coverType: string | null;
  annualPremium: number | null;
  monthlyPremium: number | null;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type LegacyMortgageDetail = {
  id: string;
  propertyId: string;
  lender: string | null;
  mortgageNumber: string | null;
  productName: string | null;
  productType: string | null;
  interestRate: number | null;
  monthlyPayment: number | null;
  productStartDate: string | null;
  productEndDate: string | null;
  mortgageTermStart: string | null;
  mortgageTermEnd: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type LegacyNotice = {
  id: string;
  tenancyId: string;
  type: string;
  dateServed: string;
  method: string;
  notes: string | null;
  createdAt: string;
  deletedAt: string | null;
};

type LegacyApplicant = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  adults: number;
  children: number;
  deletedAt: string | null;
  employmentStatus: string | null;
  hasPets: boolean;
  monthlyIncome: number | null;
  notes: string | null;
  petDetails: string | null;
  propertyId: string | null;
  requestedMoveIn: string | null;
  savingsBufferMonths: number | null;
  status: string;
  importExternalKey: string | null;
  importRawPayload: unknown;
  importSource: string | null;
  importSubmittedAt: string | null;
  screeningReason: string | null;
  screeningStatus: string | null;
  screeningSummary: string | null;
  screeningScore: number | null;
  canProvideGuarantor: boolean | null;
  guarantorRequired: boolean;
  guarantorAvailable: boolean | null;
  guarantorOutcome: string | null;
  guarantorNotes: string | null;
};

type LegacyReferencingCheck = {
  id: string;
  applicantId: string;
  idProvided: boolean;
  rightToRentChecked: boolean;
  payslipsProvided: boolean;
  bankStatementsProvided: boolean;
  employmentReference: boolean;
  landlordReference: boolean;
  creditCheckPassed: boolean | null;
  incomeVerified: boolean;
  guarantorRequired: boolean;
  guarantorProvided: boolean;
  petInsuranceProvided: boolean;
  score: number | null;
  decision: string | null;
  manualDecision: string | null;
  manualDecisionReason: string | null;
  risks: string | null;
  createdAt: string;
  updatedAt: string;
};

type LegacyGuarantor = {
  id: string;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  annualIncomePence: number | null;
  dateOfBirth: string | null;
  relationshipToApplicant: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  postcode: string | null;
  employmentStatus: string | null;
  employerName: string | null;
  jobTitle: string | null;
  notes: string | null;
  deedSigned: boolean;
  deedSignedAt: string | null;
  assessmentScore: number | null;
  assessmentSummary: string | null;
  assessmentStatus: string;
  archivedAt: string | null;
  applicantId: string | null;
};

type LegacyHoldingDeposit = {
  id: string;
  applicantId: string;
  propertyId: string | null;
  amountRequestedPence: number;
  amountReceivedPence: number | null;
  weeklyRentSnapshotPence: number | null;
  receivedAt: string | null;
  deadlineAt: string | null;
  status: string;
  outcomeReason: string | null;
  refundedAt: string | null;
  retainedAt: string | null;
  appliedAt: string | null;
  appliedTo: string | null;
  consentToApply: boolean;
  tenancySignedConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
};

type LegacyContactLog = {
  id: string;
  tenancyId: string | null;
  tenantId: string | null;
  type: string;
  date: string;
  subject: string | null;
  notes: string;
  nextFollowUp: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type ImportPlan = {
  targetUserId: string;
  targetUserEmail: string;
  legacyUserId: string;
  legacyUserEmail: string;
  normalized: {
    properties: LegacyProperty[];
    tenants: LegacyTenant[];
    tenancies: LegacyTenancy[];
    tenancyTenants: LegacyTenancyTenant[];
    payments: LegacyPayment[];
    expenses: LegacyExpense[];
    complianceItems: LegacyComplianceItem[];
    inspections: LegacyInspection[];
    insurancePolicies: LegacyInsurancePolicy[];
    mortgages: LegacyMortgageDetail[];
    notices: LegacyNotice[];
    applicants: LegacyApplicant[];
    referencingChecks: LegacyReferencingCheck[];
    guarantors: LegacyGuarantor[];
    holdingDeposits: LegacyHoldingDeposit[];
    contactLogs: LegacyContactLog[];
  };
  skipped: {
    tenancyTenants: Array<{ record: LegacyTenancyTenant; reason: string }>;
    payments: Array<{ record: LegacyPayment; reason: string }>;
    expenses: Array<{ record: LegacyExpense; reason: string }>;
    complianceItems: Array<{ record: LegacyComplianceItem; reason: string }>;
    inspections: Array<{ record: LegacyInspection; reason: string }>;
    insurancePolicies: Array<{ record: LegacyInsurancePolicy; reason: string }>;
    mortgages: Array<{ record: LegacyMortgageDetail; reason: string }>;
    notices: Array<{ record: LegacyNotice; reason: string }>;
    applicants: Array<{ record: LegacyApplicant; reason: string }>;
    referencingChecks: Array<{ record: LegacyReferencingCheck; reason: string }>;
    guarantors: Array<{ record: LegacyGuarantor; reason: string }>;
    holdingDeposits: Array<{ record: LegacyHoldingDeposit; reason: string }>;
    contactLogs: Array<{ record: LegacyContactLog; reason: string }>;
  };
  duplicateReferencingChecksDropped: Array<{
    applicantId: string;
    keptId: string;
    droppedId: string;
  }>;
};

type Summary = {
  properties: number;
  tenants: number;
  tenancies: number;
  tenancyTenants: number;
  payments: number;
  paymentAmountDue: number;
  paymentAmountPaid: number;
  paymentArrears: number;
  expenses: number;
  expenseAmount: number;
  complianceItems: number;
  inspections: number;
  insurancePolicies: number;
  mortgages: number;
  notices: number;
  applicants: number;
  referencingChecks: number;
  guarantors: number;
  holdingDeposits: number;
  contactLogs: number;
};

function argValue(flag: string) {
  const found = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return found ? found.slice(flag.length + 1) : null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function summarize(plan: ImportPlan): Summary {
  const paymentAmountDue = plan.normalized.payments.reduce(
    (sum, row) => sum + row.amountDue,
    0,
  );
  const paymentAmountPaid = plan.normalized.payments.reduce(
    (sum, row) => sum + row.amountPaid,
    0,
  );

  return {
    properties: plan.normalized.properties.length,
    tenants: plan.normalized.tenants.length,
    tenancies: plan.normalized.tenancies.length,
    tenancyTenants: plan.normalized.tenancyTenants.length,
    payments: plan.normalized.payments.length,
    paymentAmountDue,
    paymentAmountPaid,
    paymentArrears: paymentAmountDue - paymentAmountPaid,
    expenses: plan.normalized.expenses.length,
    expenseAmount: plan.normalized.expenses.reduce(
      (sum, row) => sum + row.amount,
      0,
    ),
    complianceItems: plan.normalized.complianceItems.length,
    inspections: plan.normalized.inspections.length,
    insurancePolicies: plan.normalized.insurancePolicies.length,
    mortgages: plan.normalized.mortgages.length,
    notices: plan.normalized.notices.length,
    applicants: plan.normalized.applicants.length,
    referencingChecks: plan.normalized.referencingChecks.length,
    guarantors: plan.normalized.guarantors.length,
    holdingDeposits: plan.normalized.holdingDeposits.length,
    contactLogs: plan.normalized.contactLogs.length,
  };
}

function logSummary(title: string, summary: Summary) {
  console.log(`\n${title}`);
  console.table(summary);
}

function compareSummaries(expected: Summary, actual: Summary) {
  const entries = Object.keys(expected).map((key) => {
    const typedKey = key as keyof Summary;
    return {
      metric: key,
      expected: expected[typedKey],
      actual: actual[typedKey],
      match: expected[typedKey] === actual[typedKey] ? "YES" : "NO",
    };
  });

  console.log("\nReconciliation");
  console.table(entries);

  const mismatches = entries.filter((row) => row.match === "NO");
  return mismatches;
}

async function loadExport(filePath: string): Promise<LegacyExport> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as LegacyExport;
}

function buildPlan(
  exportData: LegacyExport,
  targetUserId: string,
  targetUserEmail: string,
): ImportPlan {
  if (exportData.data.users.length !== 1) {
    throw new Error(
      `Expected exactly 1 legacy user in export, found ${exportData.data.users.length}.`,
    );
  }

  const legacyUser = exportData.data.users[0];

  const propertyIds = new Set(exportData.data.properties.map((row) => row.id));
  const tenantIds = new Set(exportData.data.tenants.map((row) => row.id));
  const tenancyIds = new Set(exportData.data.tenancies.map((row) => row.id));

  const skipped: ImportPlan["skipped"] = {
    tenancyTenants: [],
    payments: [],
    expenses: [],
    complianceItems: [],
    inspections: [],
    insurancePolicies: [],
    mortgages: [],
    notices: [],
    applicants: [],
    referencingChecks: [],
    guarantors: [],
    holdingDeposits: [],
    contactLogs: [],
  };

  const validTenancyTenants = exportData.data.tenancyTenants.filter((row) => {
    if (!tenancyIds.has(row.tenancyId)) {
      skipped.tenancyTenants.push({
        record: row,
        reason: `Missing tenancy ${row.tenancyId}`,
      });
      return false;
    }

    if (!tenantIds.has(row.tenantId)) {
      skipped.tenancyTenants.push({
        record: row,
        reason: `Missing tenant ${row.tenantId}`,
      });
      return false;
    }

    return true;
  });

  const validPayments = exportData.data.payments.filter((row) => {
    if (!tenancyIds.has(row.tenancyId)) {
      skipped.payments.push({
        record: row,
        reason: `Missing tenancy ${row.tenancyId}`,
      });
      return false;
    }

    return true;
  });

  const validExpenses = exportData.data.expenses.filter((row) => {
    if (!propertyIds.has(row.propertyId)) {
      skipped.expenses.push({
        record: row,
        reason: `Missing property ${row.propertyId}`,
      });
      return false;
    }

    if (row.tenancyId && !tenancyIds.has(row.tenancyId)) {
      skipped.expenses.push({
        record: row,
        reason: `Missing tenancy ${row.tenancyId}`,
      });
      return false;
    }

    return true;
  });

  const validComplianceItems = exportData.data.complianceItems.filter((row) => {
    if (!propertyIds.has(row.propertyId)) {
      skipped.complianceItems.push({
        record: row,
        reason: `Missing property ${row.propertyId}`,
      });
      return false;
    }

    return true;
  });

  const validInspections = exportData.data.inspections.filter((row) => {
    if (!propertyIds.has(row.propertyId)) {
      skipped.inspections.push({
        record: row,
        reason: `Missing property ${row.propertyId}`,
      });
      return false;
    }

    return true;
  });

  const validInsurancePolicies = exportData.data.insurancePolicies.filter(
    (row) => {
      if (!propertyIds.has(row.propertyId)) {
        skipped.insurancePolicies.push({
          record: row,
          reason: `Missing property ${row.propertyId}`,
        });
        return false;
      }

      return true;
    },
  );

  const validMortgages = exportData.data.mortgages.filter((row) => {
    if (!propertyIds.has(row.propertyId)) {
      skipped.mortgages.push({
        record: row,
        reason: `Missing property ${row.propertyId}`,
      });
      return false;
    }

    return true;
  });

  const validNotices = exportData.data.notices.filter((row) => {
    if (!tenancyIds.has(row.tenancyId)) {
      skipped.notices.push({
        record: row,
        reason: `Missing tenancy ${row.tenancyId}`,
      });
      return false;
    }

    return true;
  });

  const validApplicants = exportData.data.applicants.filter((row) => {
    if (row.propertyId && !propertyIds.has(row.propertyId)) {
      skipped.applicants.push({
        record: row,
        reason: `Missing property ${row.propertyId}`,
      });
      return false;
    }

    return true;
  });

  const applicantIds = new Set(validApplicants.map((row) => row.id));

  const validGuarantors = exportData.data.guarantors.filter((row) => {
    if (row.applicantId && !applicantIds.has(row.applicantId)) {
      skipped.guarantors.push({
        record: row,
        reason: `Missing applicant ${row.applicantId}`,
      });
      return false;
    }

    return true;
  });

  const validHoldingDeposits = exportData.data.holdingDeposits.filter((row) => {
    if (!applicantIds.has(row.applicantId)) {
      skipped.holdingDeposits.push({
        record: row,
        reason: `Missing applicant ${row.applicantId}`,
      });
      return false;
    }

    if (row.propertyId && !propertyIds.has(row.propertyId)) {
      skipped.holdingDeposits.push({
        record: row,
        reason: `Missing property ${row.propertyId}`,
      });
      return false;
    }

    return true;
  });

  const validContactLogs = exportData.data.contactLogs.filter((row) => {
    if (row.tenancyId && !tenancyIds.has(row.tenancyId)) {
      skipped.contactLogs.push({
        record: row,
        reason: `Missing tenancy ${row.tenancyId}`,
      });
      return false;
    }

    if (row.tenantId && !tenantIds.has(row.tenantId)) {
      skipped.contactLogs.push({
        record: row,
        reason: `Missing tenant ${row.tenantId}`,
      });
      return false;
    }

    return true;
  });

  const candidateRefChecks = exportData.data.referencingChecks.filter((row) => {
    if (!applicantIds.has(row.applicantId)) {
      skipped.referencingChecks.push({
        record: row,
        reason: `Missing applicant ${row.applicantId}`,
      });
      return false;
    }

    return true;
  });

  const latestReferencingChecks = new Map<string, LegacyReferencingCheck>();
  const duplicateReferencingChecksDropped: ImportPlan["duplicateReferencingChecksDropped"] =
    [];

  for (const row of candidateRefChecks) {
    const existing = latestReferencingChecks.get(row.applicantId);

    if (!existing) {
      latestReferencingChecks.set(row.applicantId, row);
      continue;
    }

    const existingTs = new Date(existing.updatedAt || existing.createdAt).getTime();
    const rowTs = new Date(row.updatedAt || row.createdAt).getTime();

    if (rowTs >= existingTs) {
      duplicateReferencingChecksDropped.push({
        applicantId: row.applicantId,
        keptId: row.id,
        droppedId: existing.id,
      });
      latestReferencingChecks.set(row.applicantId, row);
    } else {
      duplicateReferencingChecksDropped.push({
        applicantId: row.applicantId,
        keptId: existing.id,
        droppedId: row.id,
      });
    }
  }

  return {
    targetUserId,
    targetUserEmail,
    legacyUserId: legacyUser.id,
    legacyUserEmail: legacyUser.email,
    normalized: {
      properties: exportData.data.properties,
      tenants: exportData.data.tenants,
      tenancies: exportData.data.tenancies,
      tenancyTenants: validTenancyTenants,
      payments: validPayments,
      expenses: validExpenses,
      complianceItems: validComplianceItems,
      inspections: validInspections,
      insurancePolicies: validInsurancePolicies,
      mortgages: validMortgages,
      notices: validNotices,
      applicants: validApplicants,
      referencingChecks: Array.from(latestReferencingChecks.values()),
      guarantors: validGuarantors,
      holdingDeposits: validHoldingDeposits,
      contactLogs: validContactLogs,
    },
    skipped,
    duplicateReferencingChecksDropped,
  };
}

async function getActualSummary(targetUserId: string): Promise<Summary> {
  const [
    properties,
    tenants,
    tenancies,
    tenancyTenantsRows,
    paymentRows,
    expenseRows,
    complianceItems,
    inspections,
    insurancePolicies,
    mortgages,
    notices,
    applicants,
    referencingChecks,
    guarantors,
    holdingDeposits,
    contactLogRows,
  ] = await Promise.all([
    prisma.property.count({ where: { userId: targetUserId } }),
    prisma.tenant.count({ where: { userId: targetUserId } }),
    prisma.tenancy.count({
      where: { property: { userId: targetUserId } },
    }),
    prisma.tenancyTenant.count({
      where: { tenancy: { property: { userId: targetUserId } } },
    }),
    prisma.payment.findMany({
      where: { tenancy: { property: { userId: targetUserId } } },
      select: { amountDue: true, amountPaid: true },
    }),
    prisma.expense.findMany({
      where: { property: { userId: targetUserId } },
      select: { amount: true },
    }),
    prisma.complianceItem.count({
      where: { property: { userId: targetUserId } },
    }),
    prisma.inspection.count({
      where: { property: { userId: targetUserId } },
    }),
    prisma.insurancePolicy.count({
      where: { property: { userId: targetUserId } },
    }),
    prisma.mortgageDetail.count({
      where: { property: { userId: targetUserId } },
    }),
    prisma.notice.count({
      where: { tenancy: { property: { userId: targetUserId } } },
    }),
    prisma.applicant.count({ where: { userId: targetUserId } }),
    prisma.referencingCheck.count({
      where: { applicant: { userId: targetUserId } },
    }),
    prisma.guarantor.count({
      where: { applicant: { userId: targetUserId } },
    }),
    prisma.holdingDeposit.count({
      where: { applicant: { userId: targetUserId } },
    }),
    prisma.contactLog.findMany({
      where: {
        OR: [
          { tenancy: { property: { userId: targetUserId } } },
          { tenant: { userId: targetUserId } },
        ],
      },
      select: { id: true },
    }),
  ]);

  const paymentAmountDue = paymentRows.reduce((sum, row) => sum + row.amountDue, 0);
  const paymentAmountPaid = paymentRows.reduce((sum, row) => sum + row.amountPaid, 0);
  const expenseAmount = expenseRows.reduce((sum, row) => sum + row.amount, 0);
  const uniqueContactLogs = new Set(contactLogRows.map((row) => row.id));

  return {
    properties,
    tenants,
    tenancies,
    tenancyTenants: tenancyTenantsRows,
    payments: paymentRows.length,
    paymentAmountDue,
    paymentAmountPaid,
    paymentArrears: paymentAmountDue - paymentAmountPaid,
    expenses: expenseRows.length,
    expenseAmount,
    complianceItems,
    inspections,
    insurancePolicies,
    mortgages,
    notices,
    applicants,
    referencingChecks,
    guarantors,
    holdingDeposits,
    contactLogs: uniqueContactLogs.size,
  };
}

async function assertTargetUserReady(targetUserId: string, allowExistingData: boolean) {
  const existingCounts = await Promise.all([
    prisma.property.count({ where: { userId: targetUserId } }),
    prisma.tenant.count({ where: { userId: targetUserId } }),
    prisma.applicant.count({ where: { userId: targetUserId } }),
  ]);

  const [properties, tenants, applicants] = existingCounts;
  const hasExistingData = properties > 0 || tenants > 0 || applicants > 0;

  if (hasExistingData && !allowExistingData) {
    throw new Error(
      `Target user already has data (properties=${properties}, tenants=${tenants}, applicants=${applicants}). Re-run with --allow-existing-data only if you truly intend to merge/rerun.`,
    );
  }
}

async function runImport(plan: ImportPlan, dryRun: boolean) {
  const summary = summarize(plan);

  console.log("\nImport target");
  console.table([
    {
      legacyUserEmail: plan.legacyUserEmail,
      targetUserEmail: plan.targetUserEmail,
    },
  ]);

  logSummary("Planned imported summary", summary);

  console.log("\nSkipped invalid rows");
  console.table([
    { table: "tenancyTenants", skipped: plan.skipped.tenancyTenants.length },
    { table: "payments", skipped: plan.skipped.payments.length },
    { table: "expenses", skipped: plan.skipped.expenses.length },
    { table: "complianceItems", skipped: plan.skipped.complianceItems.length },
    { table: "inspections", skipped: plan.skipped.inspections.length },
    { table: "insurancePolicies", skipped: plan.skipped.insurancePolicies.length },
    { table: "mortgages", skipped: plan.skipped.mortgages.length },
    { table: "notices", skipped: plan.skipped.notices.length },
    { table: "applicants", skipped: plan.skipped.applicants.length },
    { table: "referencingChecks", skipped: plan.skipped.referencingChecks.length },
    { table: "guarantors", skipped: plan.skipped.guarantors.length },
    { table: "holdingDeposits", skipped: plan.skipped.holdingDeposits.length },
    { table: "contactLogs", skipped: plan.skipped.contactLogs.length },
    {
      table: "referencingChecks duplicate rows dropped",
      skipped: plan.duplicateReferencingChecksDropped.length,
    },
  ]);

  if (dryRun) {
    console.log("\nDry run only. No database changes were made.");
    return;
  }

  await prisma.property.createMany({
    data: plan.normalized.properties.map((row) => ({
      id: row.id,
      userId: plan.targetUserId,
      name: row.name,
      address1: row.address1,
      address2: row.address2,
      city: row.city,
      postcode: row.postcode,
      notes: row.notes,
      googleFormImportEnabled: row.googleFormImportEnabled,
      googleSheetId: row.googleSheetId,
      googleSheetTabName: row.googleSheetTabName,
      googleLastImportedRow: row.googleLastImportedRow,
      googleLastCheckedAt: toDate(row.googleLastCheckedAt),
      googleLastImportedAt: toDate(row.googleLastImportedAt),
      googleSyncError: row.googleSyncError,
      screeningPassMultiplier: row.screeningPassMultiplier,
      screeningGuarantorMinMultiplier: row.screeningGuarantorMinMultiplier,
      advertisedRentMonthly: row.advertisedRentMonthly,
      propertyLicenseExpiresOn: toDate(row.propertyLicenseExpiresOn),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: toDate(row.deletedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.tenant.createMany({
    data: plan.normalized.tenants.map((row) => ({
      id: row.id,
      userId: plan.targetUserId,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      notes: row.notes,
      rightToRentExpiresOn: toDate(row.rightToRentExpiresOn),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: toDate(row.deletedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.tenancy.createMany({
    data: plan.normalized.tenancies.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      startDate: new Date(row.startDate),
      endDate: toDate(row.endDate),
      rentMonthly: row.rentMonthly,
      rentDueDay: row.rentDueDay,
      isActive: row.isActive,
      notes: row.notes,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: toDate(row.deletedAt),
      autoGenerateRent: row.autoGenerateRent,
      lastRentGeneratedOn: toDate(row.lastRentGeneratedOn),
      rentGenerateMonthsAhead: row.rentGenerateMonthsAhead,
    })),
    skipDuplicates: true,
  });

  await prisma.tenancyTenant.createMany({
    data: plan.normalized.tenancyTenants.map((row) => ({
      tenancyId: row.tenancyId,
      tenantId: row.tenantId,
      role: row.role,
      createdAt: new Date(row.createdAt),
    })),
    skipDuplicates: true,
  });

  await prisma.payment.createMany({
    data: plan.normalized.payments.map((row) => ({
      id: row.id,
      tenancyId: row.tenancyId,
      dueDate: new Date(row.dueDate),
      amountDue: row.amountDue,
      amountPaid: row.amountPaid,
      paidDate: toDate(row.paidDate),
      method: row.method,
      notes: row.notes,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: toDate(row.deletedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.expense.createMany({
    data: plan.normalized.expenses.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      tenancyId: row.tenancyId,
      date: new Date(row.date),
      amount: row.amount,
      category: row.category as any,
      vendor: row.vendor,
      reference: row.reference,
      notes: row.notes,
      receiptPath: row.receiptPath,
      receiptStoragePath: row.receiptStoragePath,
      receiptOriginalName: row.receiptOriginalName,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: toDate(row.deletedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.complianceItem.createMany({
    data: plan.normalized.complianceItems.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      type: row.type as any,
      lastDone: toDate(row.lastDone),
      expiresOn: toDate(row.expiresOn),
      notes: row.notes,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: toDate(row.deletedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.inspection.createMany({
    data: plan.normalized.inspections.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      lastDate: toDate(row.lastDate),
      nextDue: toDate(row.nextDue),
      notes: row.notes,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: toDate(row.deletedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.insurancePolicy.createMany({
    data: plan.normalized.insurancePolicies.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      provider: row.provider,
      policyNumber: row.policyNumber,
      coverType: row.coverType,
      annualPremium: row.annualPremium,
      monthlyPremium: row.monthlyPremium,
      startDate: toDate(row.startDate),
      endDate: toDate(row.endDate),
      renewalDate: toDate(row.renewalDate),
      notes: row.notes,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: toDate(row.deletedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.mortgageDetail.createMany({
    data: plan.normalized.mortgages.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      lender: row.lender,
      mortgageNumber: row.mortgageNumber,
      productName: row.productName,
      productType: row.productType,
      interestRate: row.interestRate,
      monthlyPayment: row.monthlyPayment,
      productStartDate: toDate(row.productStartDate),
      productEndDate: toDate(row.productEndDate),
      mortgageTermStart: toDate(row.mortgageTermStart),
      mortgageTermEnd: toDate(row.mortgageTermEnd),
      notes: row.notes,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: toDate(row.deletedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.notice.createMany({
    data: plan.normalized.notices.map((row) => ({
      id: row.id,
      tenancyId: row.tenancyId,
      type: row.type as any,
      dateServed: new Date(row.dateServed),
      method: row.method as any,
      notes: row.notes,
      createdAt: new Date(row.createdAt),
      deletedAt: toDate(row.deletedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.applicant.createMany({
    data: plan.normalized.applicants.map((row) => ({
      id: row.id,
      userId: plan.targetUserId,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      adults: row.adults,
      children: row.children,
      deletedAt: toDate(row.deletedAt),
      employmentStatus: row.employmentStatus,
      hasPets: row.hasPets,
      monthlyIncome: row.monthlyIncome,
      notes: row.notes,
      petDetails: row.petDetails,
      propertyId: row.propertyId,
      requestedMoveIn: toDate(row.requestedMoveIn),
      savingsBufferMonths: row.savingsBufferMonths,
      status: row.status as any,
      importExternalKey: row.importExternalKey,
      importRawPayload: row.importRawPayload as any,
      importSource: row.importSource,
      importSubmittedAt: toDate(row.importSubmittedAt),
      screeningReason: row.screeningReason,
      screeningStatus: row.screeningStatus,
      screeningSummary: row.screeningSummary,
      screeningScore: row.screeningScore,
      canProvideGuarantor: row.canProvideGuarantor,
      guarantorRequired: row.guarantorRequired,
      guarantorAvailable: row.guarantorAvailable,
      guarantorOutcome: row.guarantorOutcome as any,
      guarantorNotes: row.guarantorNotes,
    })),
    skipDuplicates: true,
  });

  await prisma.referencingCheck.createMany({
    data: plan.normalized.referencingChecks.map((row) => ({
      id: row.id,
      applicantId: row.applicantId,
      idProvided: row.idProvided,
      rightToRentChecked: row.rightToRentChecked,
      payslipsProvided: row.payslipsProvided,
      bankStatementsProvided: row.bankStatementsProvided,
      employmentReference: row.employmentReference,
      landlordReference: row.landlordReference,
      creditCheckPassed: row.creditCheckPassed,
      incomeVerified: row.incomeVerified,
      guarantorRequired: row.guarantorRequired,
      guarantorProvided: row.guarantorProvided,
      petInsuranceProvided: row.petInsuranceProvided,
      score: row.score,
      decision: row.decision,
      manualDecision: row.manualDecision,
      manualDecisionReason: row.manualDecisionReason,
      risks: row.risks,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.guarantor.createMany({
    data: plan.normalized.guarantors.map((row) => ({
      id: row.id,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      annualIncomePence: row.annualIncomePence,
      dateOfBirth: toDate(row.dateOfBirth),
      relationshipToApplicant: row.relationshipToApplicant,
      address1: row.address1,
      address2: row.address2,
      city: row.city,
      postcode: row.postcode,
      employmentStatus: row.employmentStatus,
      employerName: row.employerName,
      jobTitle: row.jobTitle,
      notes: row.notes,
      deedSigned: row.deedSigned,
      deedSignedAt: toDate(row.deedSignedAt),
      assessmentScore: row.assessmentScore,
      assessmentSummary: row.assessmentSummary,
      assessmentStatus: row.assessmentStatus as any,
      archivedAt: toDate(row.archivedAt),
      applicantId: row.applicantId,
    })),
    skipDuplicates: true,
  });

  await prisma.holdingDeposit.createMany({
    data: plan.normalized.holdingDeposits.map((row) => ({
      id: row.id,
      applicantId: row.applicantId,
      propertyId: row.propertyId,
      amountRequestedPence: row.amountRequestedPence,
      amountReceivedPence: row.amountReceivedPence,
      weeklyRentSnapshotPence: row.weeklyRentSnapshotPence,
      receivedAt: toDate(row.receivedAt),
      deadlineAt: toDate(row.deadlineAt),
      status: row.status as any,
      outcomeReason: row.outcomeReason,
      refundedAt: toDate(row.refundedAt),
      retainedAt: toDate(row.retainedAt),
      appliedAt: toDate(row.appliedAt),
      appliedTo: row.appliedTo as any,
      consentToApply: row.consentToApply,
      tenancySignedConfirmed: row.tenancySignedConfirmed,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    })),
    skipDuplicates: true,
  });

  await prisma.contactLog.createMany({
    data: plan.normalized.contactLogs.map((row) => ({
      id: row.id,
      tenancyId: row.tenancyId,
      tenantId: row.tenantId,
      type: row.type as any,
      date: new Date(row.date),
      subject: row.subject,
      notes: row.notes,
      nextFollowUp: toDate(row.nextFollowUp),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: toDate(row.deletedAt),
    })),
    skipDuplicates: true,
  });

  console.log("\nImport completed.");
}

async function main() {
  const reconcileOnly = hasFlag("--reconcile-only");
  const dryRun = hasFlag("--dry-run");
  const allowExistingData = hasFlag("--allow-existing-data");

  const exportPathArg = process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : "export.json";

  const exportPath = path.resolve(process.cwd(), exportPathArg);
  const targetEmailArg = argValue("--target-email");
  const targetEmail =
    normalizeEmail(
      targetEmailArg || process.env.ADMIN_EMAIL || "",
    );

  if (!targetEmail) {
    throw new Error(
      "Target email missing. Use --target-email=you@example.com or set ADMIN_EMAIL.",
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!targetUser) {
    throw new Error(`Target user ${targetEmail} not found.`);
  }

  const exportData = await loadExport(exportPath);
  const plan = buildPlan(exportData, targetUser.id, targetUser.email);
  const expectedSummary = summarize(plan);

  console.log("\nLoaded export file");
  console.table([
    {
      file: exportPath,
      exportedAt: exportData.exportedAt,
      version: exportData.version,
      legacyUserEmail: plan.legacyUserEmail,
      targetUserEmail: plan.targetUserEmail,
      targetUserRole: targetUser.role,
    },
  ]);

  if (!reconcileOnly) {
    await assertTargetUserReady(targetUser.id, allowExistingData);
    await runImport(plan, dryRun);
  }

  const actualSummary = await getActualSummary(targetUser.id);
  logSummary("Expected imported summary", expectedSummary);
  logSummary("Actual database summary", actualSummary);

  const mismatches = compareSummaries(expectedSummary, actualSummary);

  if (plan.duplicateReferencingChecksDropped.length > 0) {
    console.log("\nReferencing checks dropped due to one-to-one target schema");
    console.table(
      plan.duplicateReferencingChecksDropped.slice(0, 20).map((row) => ({
        applicantId: row.applicantId,
        keptId: row.keptId,
        droppedId: row.droppedId,
      })),
    );
  }

  if (mismatches.length > 0) {
    throw new Error("Reconciliation failed. See mismatch table above.");
  }

  console.log("\nReconciliation passed.");
}

main()
  .catch((error) => {
    console.error("\nLegacy import failed.");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import bcrypt from "bcryptjs";
import { PrismaClient, ApplicantStatus, ComplianceType, ExpenseCategory } from "@prisma/client";
import { prisma } from "../lib/prisma";

const DEMO_USER_EMAIL =
  process.env.DEMO_USER_EMAIL?.toLowerCase().trim() || "demo.user@example.com";

const DEMO_USER_PASSWORD =
  process.env.DEMO_USER_PASSWORD || "DemoPass123!";

const SEED_ADMIN_DEMO_DATA = process.env.SEED_ADMIN_DEMO_DATA === "true";

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

async function ensureUserSettings(userId: string, email: string) {
  await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      digestEmailTo: email,
      replyToEmail: email,
    },
  });
}

async function ensureUser(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { passwordHash },
    create: { email: normalizedEmail, passwordHash },
  });

  await ensureUserSettings(user.id, user.email);

  return user;
}

async function recreateDemoUser(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();

  await prisma.user.deleteMany({
    where: { email: normalizedEmail },
  });

  return ensureUser(normalizedEmail, password);
}

async function createDemoPortfolioForUser(user: { id: string; email: string }) {
  const flat = await prisma.property.create({
    data: {
      userId: user.id,
      name: "Demo Flat A",
      address1: "10 Example Street",
      city: "London",
      postcode: "E1 1AA",
      notes: "[SEED_DEMO]",
      advertisedRentMonthly: 160000,
      screeningPassMultiplier: 3.0,
      screeningGuarantorMinMultiplier: 2.0,
      propertyLicenseExpiresOn: new Date("2027-03-31"),
    },
  });

  const house = await prisma.property.create({
    data: {
      userId: user.id,
      name: "Demo House B",
      address1: "22 Sample Road",
      city: "Romford",
      postcode: "RM12 1BB",
      notes: "[SEED_DEMO]",
      advertisedRentMonthly: 190000,
      screeningPassMultiplier: 3.0,
      screeningGuarantorMinMultiplier: 2.0,
      propertyLicenseExpiresOn: new Date("2026-10-15"),
    },
  });

  await prisma.complianceItem.createMany({
    data: [
      {
        propertyId: flat.id,
        type: ComplianceType.GAS,
        expiresOn: new Date("2026-05-01"),
        notes: "[SEED_DEMO]",
      },
      {
        propertyId: flat.id,
        type: ComplianceType.EICR,
        expiresOn: new Date("2028-01-01"),
        notes: "[SEED_DEMO]",
      },
      {
        propertyId: house.id,
        type: ComplianceType.EPC,
        expiresOn: new Date("2026-06-15"),
        notes: "[SEED_DEMO]",
      },
    ],
  });

  const tenantOne = await prisma.tenant.create({
    data: {
      userId: user.id,
      fullName: "Alice Tenant",
      email: "alice.tenant@example.com",
      phone: "07111111111",
      notes: "[SEED_DEMO]",
    },
  });

  const tenantTwo = await prisma.tenant.create({
    data: {
      userId: user.id,
      fullName: "Bob Occupier",
      email: "bob.occupier@example.com",
      phone: "07222222222",
      notes: "[SEED_DEMO]",
    },
  });

  const tenancy = await prisma.tenancy.create({
    data: {
      propertyId: flat.id,
      startDate: new Date("2025-01-01"),
      rentMonthly: 160000,
      rentDueDay: 1,
      isActive: true,
      notes: "[SEED_DEMO]",
      tenants: {
        create: [
          { tenantId: tenantOne.id, role: "Lead" },
          { tenantId: tenantTwo.id, role: "Joint" },
        ],
      },
    },
  });

  await prisma.payment.createMany({
    data: [
      {
        tenancyId: tenancy.id,
        dueDate: new Date("2026-02-01"),
        amountDue: 160000,
        amountPaid: 160000,
        paidDate: new Date("2026-02-01"),
        method: "Bank transfer",
        notes: "[SEED_DEMO]",
      },
      {
        tenancyId: tenancy.id,
        dueDate: new Date("2026-03-01"),
        amountDue: 160000,
        amountPaid: 120000,
        paidDate: new Date("2026-03-05"),
        method: "Bank transfer",
        notes: "[SEED_DEMO]",
      },
      {
        tenancyId: tenancy.id,
        dueDate: new Date("2026-04-01"),
        amountDue: 160000,
        amountPaid: 0,
        notes: "[SEED_DEMO]",
      },
    ],
  });

  await prisma.expense.create({
    data: {
      propertyId: flat.id,
      tenancyId: tenancy.id,
      date: new Date("2026-03-12"),
      amount: 18500,
      category: ExpenseCategory.REPAIRS,
      vendor: "Demo Plumbing Ltd",
      reference: "INV-DEMO-001",
      notes: "[SEED_DEMO]",
    },
  });

  await prisma.applicant.create({
    data: {
      userId: user.id,
      propertyId: house.id,
      fullName: "Charlie Applicant",
      email: "charlie.applicant@example.com",
      phone: "07333333333",
      employmentStatus: "Employed",
      monthlyIncome: 620000,
      requestedMoveIn: new Date("2026-05-01"),
      adults: 2,
      children: 0,
      hasPets: false,
      notes: "[SEED_DEMO]",
      status: ApplicantStatus.REFERENCING,
      screeningStatus: "ACCEPT",
      screeningSummary: "Pass",
      screeningReason: "Affordability passes at seeded level.",
      screeningScore: 86,
      canProvideGuarantor: true,
      referencing: {
        create: {
          idProvided: true,
          rightToRentChecked: true,
          payslipsProvided: true,
          bankStatementsProvided: true,
          employmentReference: true,
          landlordReference: true,
          creditCheckPassed: true,
          incomeVerified: true,
          guarantorRequired: false,
          guarantorProvided: false,
          petInsuranceProvided: false,
          score: 86,
          decision: "ACCEPT",
          risks: "[SEED_DEMO] Low risk seeded applicant",
        },
      },
    },
  });

  await prisma.applicant.create({
    data: {
      userId: user.id,
      propertyId: house.id,
      fullName: "Dana Applicant",
      email: "dana.applicant@example.com",
      phone: "07444444444",
      employmentStatus: "Self-employed",
      monthlyIncome: 390000,
      requestedMoveIn: new Date("2026-05-15"),
      adults: 1,
      children: 1,
      hasPets: true,
      petDetails: "One small dog",
      notes: "[SEED_DEMO]",
      status: ApplicantStatus.APPLIED,
      screeningStatus: "REVIEW",
      screeningSummary: "Manual review",
      screeningReason: "Borderline affordability, guarantor may help.",
      screeningScore: 63,
      canProvideGuarantor: true,
      guarantorRequired: true,
      referencing: {
        create: {
          idProvided: true,
          rightToRentChecked: false,
          payslipsProvided: false,
          bankStatementsProvided: true,
          employmentReference: false,
          landlordReference: true,
          creditCheckPassed: null,
          incomeVerified: false,
          guarantorRequired: true,
          guarantorProvided: true,
          petInsuranceProvided: true,
          score: 63,
          decision: "REVIEW",
          risks: "[SEED_DEMO] Borderline affordability; pet; pending checks",
        },
      },
    },
  });

  console.log(`Demo portfolio created for ${user.email}`);
}

async function maybeSeedAdminPortfolio(user: { id: string; email: string }) {
  const existingProperties = await prisma.property.count({
    where: { userId: user.id, deletedAt: null },
  });

  if (existingProperties > 0) {
    console.log("Skipping admin demo portfolio because admin already has properties.");
    return;
  }

  await createDemoPortfolioForUser(user);
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set for seeding.");
  }

  const normalizedAdminEmail = adminEmail.toLowerCase().trim();
  const normalizedDemoEmail = DEMO_USER_EMAIL.toLowerCase().trim();

  if (normalizedAdminEmail === normalizedDemoEmail) {
    throw new Error("DEMO_USER_EMAIL must not match ADMIN_EMAIL.");
  }

  const adminUser = await ensureUser(normalizedAdminEmail, adminPassword);
  console.log("Admin user ensured:", adminUser.email);

  if (process.env.SEED_DEMO_DATA !== "true") {
    console.log("Skipping demo data (SEED_DEMO_DATA not set)");
    return;
  }

  console.log("Seeding demo data...");

  if (SEED_ADMIN_DEMO_DATA) {
    await maybeSeedAdminPortfolio(adminUser);
  } else {
    console.log("Skipping admin demo portfolio (SEED_ADMIN_DEMO_DATA not set)");
  }

  const demoUser = await recreateDemoUser(DEMO_USER_EMAIL, DEMO_USER_PASSWORD);
  console.log("Demo non-admin user ensured:", demoUser.email);

  await createDemoPortfolioForUser(demoUser);

  console.log("Demo seed completed");
  console.log(`Demo login: ${DEMO_USER_EMAIL} / ${DEMO_USER_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
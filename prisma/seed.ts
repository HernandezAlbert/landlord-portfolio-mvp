import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set for seeding.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  const p1 = await prisma.property.create({
    data: {
      name: "Flat A",
      address1: "10 Example Street",
      city: "London",
      postcode: "E1 1AA",
      compliance: {
        create: [
          { type: "GAS", lastDone: new Date("2025-07-01"), expiresOn: new Date("2026-06-30") },
          { type: "EICR", lastDone: new Date("2024-01-10"), expiresOn: new Date("2029-01-09") },
          { type: "EPC", lastDone: new Date("2020-05-01"), expiresOn: new Date("2030-04-30") },
        ],
      },
      inspections: { create: [{ lastDate: new Date("2025-10-01"), nextDue: new Date("2026-04-01") }] },
    },
  });

  const p2 = await prisma.property.create({
    data: {
      name: "House B",
      address1: "22 Sample Road",
      city: "Romford",
      postcode: "RM12 1BB",
      compliance: {
        create: [
          { type: "GAS", lastDone: new Date("2025-01-15"), expiresOn: new Date("2026-01-14") },
          { type: "EICR", lastDone: new Date("2020-03-01"), expiresOn: new Date("2025-03-01") }, // expired for demo
          { type: "EPC", lastDone: new Date("2016-06-01"), expiresOn: new Date("2026-05-31") },
        ],
      },
      inspections: { create: [{ lastDate: new Date("2025-06-01"), nextDue: new Date("2025-12-01") }] }, // overdue
    },
  });

  const tenant = await prisma.tenant.create({
    data: { fullName: "John Smith", email: "john@example.com", phone: "07123 456789" },
  });

  const tenancy = await prisma.tenancy.create({
    data: {
      propertyId: p2.id,
      startDate: new Date("2024-09-01"),
      rentMonthly: 120000,
      rentDueDay: 1,
      isActive: true,
      tenants: { create: [{ tenantId: tenant.id, role: "Lead" }] },
      payments: {
        create: [
          { dueDate: new Date("2026-01-01"), amountDue: 120000, amountPaid: 60000, paidDate: new Date("2026-01-05") },
          { dueDate: new Date("2026-02-01"), amountDue: 120000, amountPaid: 0, paidDate: null },
        ],
      },
      notices: {
        create: [
          { type: "SECTION_8", dateServed: new Date("2026-02-10"), method: "POST", notes: "Ground 8/10/11 draft served" },
        ],
      },
    },
  });


  await prisma.expense.createMany({
    data: [
      { propertyId: p2.id, date: new Date("2026-02-03"), amount: 18500, category: "REPAIRS", vendor: "PlumberCo", reference: "INV-1001", notes: "Leaking tap repair" },
      { propertyId: p2.id, date: new Date("2026-02-11"), amount: 6500, category: "FEES", vendor: "Lettings Agent", reference: "MGMT-FEB", notes: "Management fee" },
    ],
  });

  await prisma.contactLog.createMany({
    data: [
      { tenancyId: tenancy.id, tenantId: tenant.id, type: "CALL", date: new Date("2026-02-12T10:30:00Z"), subject: "Arrears chase", notes: "Spoke to tenant, agreed payment by Friday.", nextFollowUp: new Date("2026-02-14") },
      { tenancyId: tenancy.id, tenantId: tenant.id, type: "EMAIL", date: new Date("2026-02-14T09:00:00Z"), subject: "Payment plan recap", notes: "Sent recap of payment plan." },
    ],
  });

  await prisma.actionOverride.upsert({
    where: { key: "ARREARS:" + tenancy.id },
    update: { note: "Consider guarantor contact", snoozedUntil: null },
    create: { key: "ARREARS:" + tenancy.id, note: "Consider guarantor contact", snoozedUntil: null },
  });

  console.log("Seed complete", { p1: p1.id, p2: p2.id, tenancy: tenancy.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set for seeding.");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { passwordHash },
    create: { email: normalizedEmail, passwordHash },
  });

  console.log("Admin user ensured:", normalizedEmail);

  if (process.env.SEED_DEMO_DATA !== "true") {
    console.log("Skipping demo data (SEED_DEMO_DATA not set)");
    return;
  }

  console.log("Seeding demo data...");

  const p1 = await prisma.property.create({
    data: {
      userId: adminUser.id,
      name: "Flat A",
      address1: "10 Example Street",
      city: "London",
      postcode: "E1 1AA",
    },
  });

  const p2 = await prisma.property.create({
    data: {
      userId: adminUser.id,
      name: "House B",
      address1: "22 Sample Road",
      city: "Romford",
      postcode: "RM12 1BB",
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      userId: adminUser.id,
      fullName: "John Smith",
      email: "john@example.com",
    },
  });

  await prisma.tenancy.create({
    data: {
      propertyId: p2.id,
      startDate: new Date("2024-09-01"),
      rentMonthly: 120000,
      rentDueDay: 1,
      isActive: true,
      tenants: { create: [{ tenantId: tenant.id, role: "Lead" }] },
    },
  });

  console.log("Demo data created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
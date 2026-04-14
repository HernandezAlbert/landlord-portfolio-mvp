import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const now = new Date();

  const [
    users,
    properties,
    tenants,
    tenancies,
    tenancyTenants,
    payments,
    expenses,
    complianceItems,
    inspections,
    insurancePolicies,
    mortgages,
    notices,
    applicants,
    referencingChecks,
    guarantors,
    holdingDeposits,
    contactLogs,
  ] = await Promise.all([
    prisma.user.findMany(),

    prisma.property.findMany({
      where: { deletedAt: null },
    }),

    prisma.tenant.findMany({
      where: { deletedAt: null },
    }),

    prisma.tenancy.findMany({
      where: { deletedAt: null },
    }),

    prisma.tenancyTenant.findMany(),

    prisma.payment.findMany({
      where: { deletedAt: null },
    }),

    prisma.expense.findMany({
      where: { deletedAt: null },
    }),

    prisma.complianceItem.findMany({
      where: { deletedAt: null },
    }),

    prisma.inspection.findMany({
      where: { deletedAt: null },
    }),

    prisma.insurancePolicy.findMany({
      where: { deletedAt: null },
    }),

    prisma.mortgageDetail.findMany({
      where: { deletedAt: null },
    }),

    prisma.notice.findMany({
      where: { deletedAt: null },
    }),

    prisma.applicant.findMany({
      where: { deletedAt: null },
    }),

    prisma.referencingCheck.findMany(),

    prisma.guarantor.findMany(),

    prisma.holdingDeposit.findMany(),

    prisma.contactLog.findMany({
      where: { deletedAt: null },
    }),
  ]);

  const payload = {
    exportedAt: now.toISOString(),
    version: "v1",
    counts: {
        users: users.length,
        properties: properties.length,
        tenants: tenants.length,
        tenancies: tenancies.length,
        tenancyTenants: tenancyTenants.length,
        payments: payments.length,
        expenses: expenses.length,
        complianceItems: complianceItems.length,
        inspections: inspections.length,
        insurancePolicies: insurancePolicies.length,
        mortgages: mortgages.length,
        notices: notices.length,
        applicants: applicants.length,
        referencingChecks: referencingChecks.length,
        guarantors: guarantors.length,
        holdingDeposits: holdingDeposits.length,
        contactLogs: contactLogs.length,
        },
    data: {
      users,
      properties,
      tenants,
      tenancies,
      tenancyTenants,
      payments,
      expenses,
      complianceItems,
      inspections,
      insurancePolicies,
      mortgages,
      notices,
      applicants,
      referencingChecks,
      guarantors,
      holdingDeposits,
      contactLogs,
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="landlord-export-${now.toISOString().slice(0, 10)}.json"`,
    },
  });
}
import { prisma } from "@/lib/prisma";

export async function GET() {
  const data = {
    exportedAt: new Date().toISOString(),
    users: await prisma.user.findMany(),
    properties: await prisma.property.findMany({ include: { mortgage: true } }),
    tenants: await prisma.tenant.findMany(),
    tenancies: await prisma.tenancy.findMany(),
    tenancyTenants: await prisma.tenancyTenant.findMany(),
    payments: await prisma.payment.findMany(),
    complianceItems: await prisma.complianceItem.findMany(),
    inspections: await prisma.inspection.findMany(),
    notices: await prisma.notice.findMany(),
    expenses: await prisma.expense.findMany(),
    contactLogs: await prisma.contactLog.findMany(),
    actionOverrides: await prisma.actionOverride.findMany(),
    reminderConfigs: await prisma.reminderConfig.findMany(),
    emailLogs: await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    mortgageDetails: await prisma.mortgageDetail.findMany(),
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="landlord-portfolio-backup-${new Date().toISOString().slice(0,10)}.json"`,
    },
  });
}

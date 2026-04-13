import { prisma } from "./prisma";
import { daysBetween, ragFromDaysRemaining } from "./rag";
import { getTenancyArrears, isSection8Eligible } from "./arrears";

export type ActionItem = {
  key: string;
  category: "COMPLIANCE" | "INSPECTION" | "ARREARS" | "NOTICE" | "MORTGAGE" | "TENANT";
  subject: string;
  propertyId?: string;
  tenancyId?: string;
  tenantId?: string;
  nextAction: string;
  dueDate?: Date | null;
  daysRemaining?: number | null;
  rag: "RED" | "AMBER" | "GREEN";
  note?: string | null;
  snoozedUntil?: Date | null;
};

export async function buildWeeklyActionList(
  asOf = new Date(),
): Promise<ActionItem[]> {
  const [properties, tenancies] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null },
      include: {
        compliance: { where: { deletedAt: null } },
        inspections: { where: { deletedAt: null } },
        mortgage: true,
      },
      orderBy: { createdAt: "asc" },
    }),

    prisma.tenancy.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        property: { select: { id: true, name: true } },
        tenants: {
          include: {
            tenant: {
              select: {
                id: true,
                fullName: true,
                deletedAt: true,
                rightToRentExpiresOn: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const actions: ActionItem[] = [];

  for (const prop of properties) {
    for (const c of prop.compliance) {
      const days = c.expiresOn ? daysBetween(asOf, c.expiresOn) : null;
      const rag = ragFromDaysRemaining(days);

      let nextAction = "No action";
      if (days === null) nextAction = "Confirm expiry date";
      else if (days < 0) nextAction = `Expired: renew ${c.type}`;
      else if (days <= 30) nextAction = `Renew ${c.type} now`;
      else if (days <= 60) nextAction = `Book ${c.type} renewal`;

      if (nextAction !== "No action") {
        actions.push({
          key: `COMPLIANCE:${c.id}`,
          category: "COMPLIANCE",
          subject: `${prop.name} (${c.type})`,
          propertyId: prop.id,
          nextAction,
          dueDate: c.expiresOn ?? null,
          daysRemaining: days,
          rag,
        });
      }
    }

    if (prop.propertyLicenseExpiresOn) {
      const days = daysBetween(asOf, prop.propertyLicenseExpiresOn);
      const rag = ragFromDaysRemaining(days);

      let nextAction = "No action";
      if (days < 0) nextAction = "Property licence expired: renew now";
      else if (days <= 30) nextAction = "Renew property licence now";
      else if (days <= 60) nextAction = "Prepare property licence renewal";

      if (nextAction !== "No action") {
        actions.push({
          key: `PROPERTY_LICENSE:${prop.id}`,
          category: "COMPLIANCE",
          subject: `${prop.name} (Property licence)`,
          propertyId: prop.id,
          nextAction,
          dueDate: prop.propertyLicenseExpiresOn,
          daysRemaining: days,
          rag,
        });
      }
    }

    if (prop.mortgage && !prop.mortgage.deletedAt) {
      const days = prop.mortgage.productEndDate
        ? daysBetween(asOf, prop.mortgage.productEndDate)
        : null;

      const rag =
        days === null ? "GREEN" : days <= 30 ? "RED" : days <= 90 ? "AMBER" : "GREEN";

      let nextAction = "No action";
      if (days === null) nextAction = "Confirm mortgage product end date";
      else if (days < 0) nextAction = "Mortgage product ended: review / remortgage now";
      else if (days <= 30) nextAction = "Mortgage product ending soon: remortgage now";
      else if (days <= 90) nextAction = "Start remortgage review";

      if (nextAction !== "No action") {
        actions.push({
          key: `MORTGAGE:${prop.mortgage.id}`,
          category: "MORTGAGE",
          subject: `${prop.name} (${prop.mortgage.lender ?? "Mortgage"})`,
          propertyId: prop.id,
          nextAction,
          dueDate: prop.mortgage.productEndDate ?? null,
          daysRemaining: days,
          rag,
        });
      }
    }

    for (const i of prop.inspections) {
      const days = i.nextDue ? daysBetween(asOf, i.nextDue) : null;
      const rag = ragFromDaysRemaining(days);

      let nextAction = "No action";
      if (days === null) nextAction = "Set next inspection due";
      else if (days < 0) nextAction = "Overdue: schedule inspection";
      else if (days <= 30) nextAction = "Schedule inspection";

      if (nextAction !== "No action") {
        actions.push({
          key: `INSPECTION:${i.id}`,
          category: "INSPECTION",
          subject: `${prop.name} (Inspection)`,
          propertyId: prop.id,
          nextAction,
          dueDate: i.nextDue ?? null,
          daysRemaining: days,
          rag,
        });
      }
    }
  }

  for (const t of tenancies) {
    const arrears = await getTenancyArrears(t.id, asOf);

    if (arrears > 0) {
      const s8 = await isSection8Eligible(t.id, asOf);

      actions.push({
        key: `ARREARS:${t.id}`,
        category: "ARREARS",
        subject: `Tenancy ${t.id}`,
        tenancyId: t.id,
        nextAction: s8 ? "Consider Section 8 (>=2 months arrears)" : "Chase arrears",
        dueDate: null,
        daysRemaining: null,
        rag: s8 ? "RED" : "AMBER",
      });
    }

    for (const tenancyTenant of t.tenants) {
      const tenant = tenancyTenant.tenant;
      if (tenant.deletedAt || !tenant.rightToRentExpiresOn) continue;

      const days = daysBetween(asOf, tenant.rightToRentExpiresOn);
      if (days > 60) continue;

      const rag = ragFromDaysRemaining(days);

      let nextAction = "No action";
      if (days < 0) nextAction = "Right to Rent expired: repeat check immediately";
      else if (days <= 30) nextAction = "Right to Rent expiring soon: repeat check now";
      else nextAction = "Right to Rent expires within 60 days: prepare follow-up check";

      actions.push({
        key: `TENANT_RTR:${tenant.id}`,
        category: "TENANT",
        subject: `${tenant.fullName} (${t.property.name})`,
        propertyId: t.property.id,
        tenancyId: t.id,
        tenantId: tenant.id,
        nextAction,
        dueDate: tenant.rightToRentExpiresOn,
        daysRemaining: days,
        rag,
      });
    }
  }

  const rank = (r: string) => (r === "RED" ? 0 : r === "AMBER" ? 1 : 2);

  actions.sort((a, b) => {
    const rr = rank(a.rag) - rank(b.rag);
    if (rr !== 0) return rr;

    const ad = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bd = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return ad - bd;
  });

  return actions;
}
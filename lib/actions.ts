import { prisma } from "./prisma";
import { daysBetween, ragFromDaysRemaining } from "./rag";
import { getTenancyArrears, isSection8Eligible } from "./arrears";

export type ActionItem = {
  key: string;
  category: "COMPLIANCE" | "INSPECTION" | "ARREARS" | "NOTICE" | "MORTGAGE";
  subject: string;
  propertyId?: string;
  tenancyId?: string;
  nextAction: string;
  dueDate?: Date | null;
  daysRemaining?: number | null;
  rag: "RED" | "AMBER" | "GREEN";
  note?: string | null;
  snoozedUntil?: Date | null;
};

export async function buildWeeklyActionList(asOf = new Date()): Promise<ActionItem[]> {
  const [properties, tenancies] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null },
      include: { compliance: { where: { deletedAt: null } }, inspections: { where: { deletedAt: null } }, mortgage: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tenancy.findMany({ where: { isActive: true, deletedAt: null }, orderBy: { createdAt: "asc" } }),
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



    if (prop.mortgage && !prop.mortgage.deletedAt) {
      const days = prop.mortgage.productEndDate ? daysBetween(asOf, prop.mortgage.productEndDate) : null;
      const rag = days === null ? "GREEN" : days <= 30 ? "RED" : days <= 90 ? "AMBER" : "GREEN";

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

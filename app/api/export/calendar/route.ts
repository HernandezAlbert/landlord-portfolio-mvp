import { prisma } from "@/lib/prisma";
import { buildIcs } from "@/lib/ics";

export async function GET() {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setUTCFullYear(horizon.getUTCFullYear() + 1);

  const [compliance, inspections] = await Promise.all([
    prisma.complianceItem.findMany({
      where: { deletedAt: null, expiresOn: { not: null, lte: horizon } , property: { deletedAt: null } },
      include: { property: true },
      orderBy: { expiresOn: "asc" },
    }),
    prisma.inspection.findMany({
      where: { deletedAt: null, nextDue: { not: null, lte: horizon }, property: { deletedAt: null } },
      include: { property: true },
      orderBy: { nextDue: "asc" },
    }),
  ]);

  const events = [
    ...compliance
      .filter(c => c.expiresOn)
      .map(c => ({
        uid: `compliance-${c.id}@landlord-portfolio`,
        dtstart: c.expiresOn!,
        summary: `${c.type} expiry — ${c.property.name}`,
        description: `${c.property.address1}, ${c.property.postcode}`,
      })),
    ...inspections
      .filter(i => i.nextDue)
      .map(i => ({
        uid: `inspection-${i.id}@landlord-portfolio`,
        dtstart: i.nextDue!,
        summary: `Inspection due — ${i.property.name}`,
        description: `${i.property.address1}, ${i.property.postcode}`,
      })),
  ];

  const ics = buildIcs(events);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="landlord-portfolio.ics"',
    },
  });
}

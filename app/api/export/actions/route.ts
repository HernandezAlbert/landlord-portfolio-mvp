import { buildWeeklyActionList } from "@/lib/actions";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const actions = await buildWeeklyActionList(new Date());

  const rows = actions.map((a) => ({
    category: a.category,
    subject: a.subject,
    nextAction: a.nextAction,
    dueDate: a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "",
    daysRemaining: a.daysRemaining ?? "",
    rag: a.rag,
    propertyId: a.propertyId ?? "",
    tenancyId: a.tenancyId ?? "",
    note: a.note ?? "",
    snoozedUntil: a.snoozedUntil ? a.snoozedUntil.toISOString().slice(0,10) : "",
  }));

  const csv = toCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="actions.csv"',
    },
  });
}

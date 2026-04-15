import { buildWeeklyActionList } from "@/lib/actions";
import { toCsv } from "@/lib/csv";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  const actions = await buildWeeklyActionList(sessionUser.id, new Date());

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
    snoozedUntil: a.snoozedUntil ? a.snoozedUntil.toISOString().slice(0, 10) : "",
  }));

  const csv = toCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="actions.csv"',
    },
  });
}
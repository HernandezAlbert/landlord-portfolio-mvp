import { buildWeeklyActionList } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SubmitButton from "@/components/SubmitButton";

export default async function ActionsPage() {
  const asOf = new Date();
  const actions = await buildWeeklyActionList(asOf);

  async function saveOverride(formData: FormData) {
    "use server";
    const key = String(formData.get("key") ?? "");
    const note = String(formData.get("note") ?? "").trim();
    const snoozedUntil = String(formData.get("snoozedUntil") ?? "").trim();

    if (!key) redirect("/actions");

    await prisma.actionOverride.upsert({
      where: { key },
      create: {
        key,
        note: note || null,
        snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null,
      },
      update: {
        note: note || null,
        snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null,
      },
    });

    redirect("/actions");
  }

  async function clearOverride(formData: FormData) {
    "use server";
    const key = String(formData.get("key") ?? "");
    if (!key) redirect("/actions");
    await prisma.actionOverride.delete({ where: { key } }).catch(() => {});
    redirect("/actions");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Weekly action list</h1>
          <p className="mt-1 text-sm text-slate-500">Urgent follow-ups, compliance renewals, arrears and other next actions across the portfolio.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/actions" className="btn btn-secondary btn-sm">Export actions CSV</a>
          <a href="/api/export/payments" className="btn btn-secondary btn-sm">Export payments CSV</a>
          <a href="/api/export/calendar" className="btn btn-secondary btn-sm">Export calendar (.ics)</a>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">RAG</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Next action</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Days</th>
              <th className="px-4 py-3 font-medium">Note / snooze</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.key} className="border-t border-slate-200 align-top">
                <td className="px-4 py-3 font-semibold">
                  <span className={`rounded-full px-2.5 py-1 text-xs ${a.rag === "RED" ? "bg-red-100 text-red-700" : a.rag === "AMBER" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                    {a.rag}
                  </span>
                </td>
                <td className="px-4 py-3">{a.category}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{a.subject}</td>
                <td className="px-4 py-3">{a.nextAction}</td>
                <td className="px-4 py-3">{a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "—"}</td>
                <td className="px-4 py-3">{a.daysRemaining ?? "—"}</td>
                <td className="px-4 py-3 min-w-[320px]">
                  <form action={saveOverride} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <input type="hidden" name="key" value={a.key} />
                    <textarea name="note" defaultValue={a.note ?? ""} placeholder="Optional note…" rows={2} className="rounded-lg border border-slate-300 px-3 py-2" />
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Snooze until</label>
                      <input type="date" name="snoozedUntil" defaultValue={a.snoozedUntil ? a.snoozedUntil.toISOString().slice(0, 10) : ""} className="rounded-lg border border-slate-300 px-3 py-2" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton pendingLabel="Saving...">Save action note</SubmitButton>
                    </div>
                  </form>
                  <form action={clearOverride} className="mt-2">
                    <input type="hidden" name="key" value={a.key} />
                    <SubmitButton variant="secondary" pendingLabel="Clearing...">Clear override</SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

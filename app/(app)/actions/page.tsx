// app/(app)/actions/page.tsx
// Replace the entire file with this exact version.

import { buildWeeklyActionList } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SubmitButton from "@/components/SubmitButton";
import { getSessionUser } from "@/lib/auth";

export default async function ActionsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/login");
  }

  const asOf = new Date();
  const actions = await buildWeeklyActionList(sessionUser.id, asOf);

  async function saveOverride(formData: FormData) {
    "use server";

    const currentUser = await getSessionUser();
    if (!currentUser) {
      redirect("/login");
    }

    const key = String(formData.get("key") ?? "");
    const note = String(formData.get("note") ?? "").trim();
    const snoozedUntil = String(formData.get("snoozedUntil") ?? "").trim();

    if (!key) redirect("/actions");

    await prisma.actionOverride.upsert({
      where: {
        userId_key: {
          userId: currentUser.id,
          key,
        },
      },
      create: {
        userId: currentUser.id,
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

    const currentUser = await getSessionUser();
    if (!currentUser) {
      redirect("/login");
    }

    const key = String(formData.get("key") ?? "");
    if (!key) redirect("/actions");

    await prisma.actionOverride.deleteMany({
      where: {
        userId: currentUser.id,
        key,
      },
    });

    redirect("/actions");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Weekly action list</h1>
        <p className="mt-2 text-sm text-slate-600">
          Urgent follow-ups, compliance renewals, arrears and other next actions across the
          portfolio.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/export/actions" className="btn btn-secondary btn-sm">
            Export actions CSV
          </a>
          <a href="/api/export/payments" className="btn btn-secondary btn-sm">
            Export payments CSV
          </a>
          <a href="/api/export/calendar" className="btn btn-secondary btn-sm">
            Export calendar (.ics)
          </a>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border bg-white p-6 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="pb-3 pr-4">RAG</th>
              <th className="pb-3 pr-4">Category</th>
              <th className="pb-3 pr-4">Subject</th>
              <th className="pb-3 pr-4">Next action</th>
              <th className="pb-3 pr-4">Due</th>
              <th className="pb-3 pr-4">Days</th>
              <th className="pb-3">Note / snooze</th>
            </tr>
          </thead>

          <tbody>
            {actions.map((a) => (
              <tr key={a.key} className="align-top border-t">
                <td className="py-4 pr-4">{a.rag}</td>
                <td className="py-4 pr-4">{a.category}</td>
                <td className="py-4 pr-4">{a.subject}</td>
                <td className="py-4 pr-4">{a.nextAction}</td>
                <td className="py-4 pr-4">
                  {a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="py-4 pr-4">{a.daysRemaining ?? "—"}</td>
                <td className="py-4">
                  <form action={saveOverride} className="space-y-3">
                    <input type="hidden" name="key" value={a.key} />

                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                        Note
                      </label>
                      <textarea
                        name="note"
                        defaultValue={a.note ?? ""}
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Snooze until
                      </label>
                      <input
                        type="date"
                        name="snoozedUntil"
                        defaultValue={
                          a.snoozedUntil ? a.snoozedUntil.toISOString().slice(0, 10) : ""
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <SubmitButton pendingLabel="Saving...">
                        Save action note
                      </SubmitButton>
                    </div>
                  </form>

                  <form action={clearOverride} className="mt-2">
                    <input type="hidden" name="key" value={a.key} />
                    <SubmitButton variant="secondary" pendingLabel="Clearing...">
                      Clear override
                    </SubmitButton>
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
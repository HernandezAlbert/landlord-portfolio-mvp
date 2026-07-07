import { prisma } from "@/lib/prisma";
import { getTotalArrears, isSection8Eligible } from "@/lib/arrears";
import { buildWeeklyActionList } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth";
import { formatGBPFromPence } from "@/lib/money";
import { redirect } from "next/navigation";

function money(pence: number) {
  return formatGBPFromPence(pence);
}

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/login");
  }

  const asOf = new Date();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [activeTenancies, totalArrears, actions, monthExpenses] = await Promise.all([
    prisma.tenancy.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        property: {
          userId: sessionUser.id,
        },
      },
      select: { id: true, rentMonthly: true },
    }),
    getTotalArrears(sessionUser.id, asOf),
    buildWeeklyActionList(sessionUser.id, asOf),
    prisma.expense.aggregate({
      where: {
        deletedAt: null,
        date: { gte: monthStart },
        property: {
          deletedAt: null,
          userId: sessionUser.id,
        },
      },
      _sum: { amount: true },
    }),
  ]);

  const monthlyRent = activeTenancies.reduce((s, t) => s + t.rentMonthly, 0);
  const expensesThisMonth = monthExpenses._sum.amount ?? 0;
  const netThisMonth = monthlyRent - expensesThisMonth;
  const redCount = actions.filter((a) => a.rag === "RED").length;
  const s8Flags = await Promise.all(
    activeTenancies.map((t) => isSection8Eligible(sessionUser.id, t.id, asOf)),
  );
  const s8Count = s8Flags.filter(Boolean).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Monthly rent</div>
          <div className="text-2xl font-semibold">{money(monthlyRent)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Total arrears</div>
          <div className="text-2xl font-semibold">{money(totalArrears)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Expenses (this month)</div>
          <div className="text-2xl font-semibold">{money(expensesThisMonth)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Net (rent - expenses)</div>
          <div className="text-2xl font-semibold">{money(netThisMonth)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Red items</div>
          <div className="text-2xl font-semibold">{redCount}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Section 8 eligible</div>
          <div className="text-2xl font-semibold">{s8Count}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">This week’s actions</h2>
        <div className="mt-3">
          <a href="/actions" className="btn btn-secondary btn-sm">
            Open
          </a>
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          {actions.slice(0, 12).map((a, idx) => (
            <li key={idx}>
              [{a.rag}] {a.nextAction} — {a.subject}
              {a.dueDate ? ` (due ${a.dueDate.toISOString().slice(0, 10)})` : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

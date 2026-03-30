import { prisma } from "@/lib/prisma";
import { getTotalArrears, isSection8Eligible } from "@/lib/arrears";
import { buildWeeklyActionList } from "@/lib/actions";

function money(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default async function DashboardPage() {
  const asOf = new Date();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0,0,0,0);

  const [activeTenancies, totalArrears, actions, monthExpenses] = await Promise.all([
    prisma.tenancy.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, rentMonthly: true } }),
    getTotalArrears(asOf),
    buildWeeklyActionList(asOf),
    prisma.expense.aggregate({ where: { deletedAt: null, date: { gte: monthStart }, property: { deletedAt: null } }, _sum: { amount: true } }),
  ]);

  const monthlyRent = activeTenancies.reduce((s, t) => s + t.rentMonthly, 0);
  const expensesThisMonth = monthExpenses._sum.amount ?? 0;
  const netThisMonth = monthlyRent - expensesThisMonth;

  const redCount = actions.filter((a) => a.rag === "RED").length;

  const s8Flags = await Promise.all(activeTenancies.map((t) => isSection8Eligible(t.id, asOf)));
  const s8Count = s8Flags.filter(Boolean).length;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12 }}>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
          <div style={{ opacity: 0.7 }}>Monthly rent</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{money(monthlyRent)}</div>
        </div>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
          <div style={{ opacity: 0.7 }}>Total arrears</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{money(totalArrears)}</div>
        </div>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
          <div style={{ opacity: 0.7 }}>Expenses (this month)</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{money(expensesThisMonth)}</div>
        </div>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
          <div style={{ opacity: 0.7 }}>Net (rent - expenses)</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{money(netThisMonth)}</div>
        </div>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
          <div style={{ opacity: 0.7 }}>Red items</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{redCount}</div>
        </div>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
          <div style={{ opacity: 0.7 }}>Section 8 eligible</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{s8Count}</div>
        </div>
      </div>

      <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>This week’s actions</h2>
          <a href="/actions" style={{ opacity: 0.8 }}>Open</a>
        </div>

        <ul style={{ marginTop: 10 }}>
          {actions.slice(0, 12).map((a, idx) => (
            <li key={idx}>
              <strong>[{a.rag}]</strong> {a.nextAction} — {a.subject}
              {a.dueDate ? <span style={{ opacity: 0.75 }}> (due {a.dueDate.toISOString().slice(0, 10)})</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

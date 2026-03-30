import Link from "next/link";
import { buildWeeklyActionList } from "@/lib/actions";
import { getTotalArrears, isSection8Eligible } from "@/lib/arrears";
import { getPortfolioFinanceSummary, money } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import StatCard from "@/components/StatCard";
import ClickableActionRow from "@/components/ClickableActionRow";

export default async function DashboardPage() {
  const today = new Date();

  const [activeTenancies, totalArrears, actions, finance] = await Promise.all([
    prisma.tenancy.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, rentMonthly: true, property: { select: { id: true, name: true } } },
    }),
    getTotalArrears(today),
    buildWeeklyActionList(today),
    getPortfolioFinanceSummary(today),
  ]);

  const monthlyRent = activeTenancies.reduce((s, t) => s + t.rentMonthly, 0);
  const redCount = actions.filter((a) => a.rag === "RED").length;
  const s8Flags = await Promise.all(activeTenancies.map((t) => isSection8Eligible(t.id, today)));
  const s8Count = s8Flags.filter(Boolean).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Monthly Rent" value={money(monthlyRent)} colour="text-green-700" href="/tenancies" />
        <StatCard title="Total Arrears" value={money(totalArrears)} colour={totalArrears > 0 ? "text-red-700" : "text-green-700"} href="/actions" />
        <StatCard title="Red Items" value={redCount} colour={redCount > 0 ? "text-red-700" : "text-green-700"} href="/actions" />
        <StatCard title="Section 8 Eligible" value={s8Count} colour={s8Count > 0 ? "text-amber-700" : "text-green-700"} href="/actions" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Due This Month" value={money(finance.scheduledThisMonth)} colour="text-slate-900" href="/finance" />
        <StatCard title="Received This Month" value={money(finance.cashReceivedThisMonth)} colour={finance.cashReceivedThisMonth > 0 ? "text-green-700" : "text-slate-900"} href="/finance" />
        <StatCard title="Outstanding This Month" value={money(finance.outstandingThisMonth)} colour={finance.outstandingThisMonth > 0 ? "text-red-700" : "text-green-700"} href="/finance" />
        <StatCard title="Expenses This Month" value={money(finance.expensesThisMonth)} colour="text-slate-900" href="/expenses" />
        <StatCard title="Net Cashflow" value={money(finance.estimatedNetCashflow)} colour={finance.estimatedNetCashflow >= 0 ? "text-green-700" : "text-red-700"} href="/finance" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.8fr,1fr]">
        <div className="bg-white border rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">Weekly Action List</h2>
            <Link href="/actions" className="btn btn-secondary btn-sm">View all</Link>
          </div>
          {actions.length === 0 ? (
            <p className="text-sm text-slate-500">No urgent actions.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">RAG</th>
                  <th>Category</th>
                  <th>Subject</th>
                  <th>Next Action</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {actions.slice(0, 10).map((a, idx) => {
                  const href = a.tenancyId ? `/tenancies/${a.tenancyId}` : a.propertyId ? `/properties/${a.propertyId}` : "/actions";
                  return (
                    <ClickableActionRow key={idx} href={href}>
                      <td className="py-2"><span className={a.rag === "RED" ? "text-red-600" : a.rag === "AMBER" ? "text-amber-600" : "text-green-600"}>{a.rag}</span></td>
                      <td>{a.category}</td>
                      <td>{a.subject}</td>
                      <td>{a.nextAction}</td>
                      <td>{a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "—"}</td>
                    </ClickableActionRow>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Overdue payments</h2>
            <Link href="/finance" className="btn btn-secondary btn-sm">Finance view</Link>
          </div>
          <div className="space-y-3">
            {finance.overduePayments.slice(0, 6).map((payment) => {
              const outstanding = Math.max(0, payment.amountDue - payment.amountPaid);
              const tenantNames = payment.tenancy.tenants.map((tt) => tt.tenant.fullName).join(", ") || "No tenants";
              return (
                <div key={payment.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="font-medium text-slate-900">{payment.tenancy.property.name}</div>
                  <div className="text-sm text-slate-500">{tenantNames}</div>
                  <div className="mt-1 text-sm text-slate-700">Due {payment.dueDate.toISOString().slice(0, 10)} · Outstanding {money(outstanding)}</div>
                  <Link href={`/tenancies/${payment.tenancyId}/payments#${payment.id}`} className="mt-2 btn btn-secondary btn-sm">Open payment line</Link>
                </div>
              );
            })}
            {!finance.overduePayments.length && <p className="text-sm text-slate-500">No overdue payments right now.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

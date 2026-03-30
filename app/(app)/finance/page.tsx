import Link from "next/link";
import { getPortfolioFinanceSummary, getPropertyFinanceRows, money } from "@/lib/finance";

function fmt(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function FinancePage() {
  const asOf = new Date();
  const [summary, rows] = await Promise.all([
    getPortfolioFinanceSummary(asOf),
    getPropertyFinanceRows(asOf),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Rent due, rent received, arrears and monthly cashflow across the portfolio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/finance/reporting" className="btn btn-secondary btn-sm">Reporting & accountant pack</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Contracted monthly rent", money(summary.monthlyContractedRent), "text-green-700"],
          ["Due this month", money(summary.scheduledThisMonth), "text-slate-900"],
          ["Cash received this month", money(summary.cashReceivedThisMonth), summary.cashReceivedThisMonth > 0 ? "text-green-700" : "text-slate-900"],
          ["Outstanding this month", money(summary.outstandingThisMonth), summary.outstandingThisMonth > 0 ? "text-red-700" : "text-green-700"],
          ["Estimated net cashflow", money(summary.estimatedNetCashflow), summary.estimatedNetCashflow >= 0 ? "text-green-700" : "text-red-700"],
        ].map(([title, value, tone]) => (
          <div key={String(title)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">{title}</div>
            <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-900">Property performance this month</h2>
            <span className="text-sm text-slate-500">As of {fmt(asOf)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Rent</th>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Overdue</th>
                <th className="px-4 py-3 font-medium">Mortgage</th>
                <th className="px-4 py-3 font-medium">Expenses</th>
                <th className="px-4 py-3 font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link className="hover:underline" href={`/properties/${row.id}`}>{row.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{money(row.contractedRent)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.receivedThisMonth)}</td>
                  <td className={`px-4 py-3 font-medium ${row.overdue > 0 ? "text-red-700" : "text-slate-700"}`}>{money(row.overdue)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.mortgageMonthly)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(row.expensesThisMonth)}</td>
                  <td className={`px-4 py-3 font-medium ${row.estimatedNetThisMonth >= 0 ? "text-green-700" : "text-red-700"}`}>{money(row.estimatedNetThisMonth)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-slate-500">No properties found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Overdue payment lines</h2>
            <Link className="btn btn-secondary btn-sm" href="/tenancies">Open tenancies</Link>
          </div>
          <div className="mt-4 space-y-3">
            {summary.overduePayments.map((payment) => {
              const outstanding = Math.max(0, payment.amountDue - payment.amountPaid);
              const tenants = payment.tenancy.tenants.map((tt) => tt.tenant.fullName).join(", ") || "No tenants";
              return (
                <div key={payment.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="font-medium text-slate-900">{payment.tenancy.property.name}</div>
                  <div className="text-sm text-slate-500">{tenants}</div>
                  <div className="mt-1 text-sm text-slate-700">Due {fmt(payment.dueDate)} · Outstanding {money(outstanding)}</div>
                  <Link href={`/tenancies/${payment.tenancyId}/payments#${payment.id}`} className="mt-2 btn btn-secondary btn-sm">
                    Open payment line
                  </Link>
                </div>
              );
            })}
            {!summary.overduePayments.length && (
              <p className="text-sm text-slate-500">No overdue payment lines right now.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

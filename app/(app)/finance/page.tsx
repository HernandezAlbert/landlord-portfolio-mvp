import Link from "next/link";
import { getPortfolioFinanceSummary, getPropertyFinanceRows, money } from "@/lib/finance";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

function fmt(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function FinancePage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/login");
  }

  const asOf = new Date();

  const [summary, rows] = await Promise.all([
    getPortfolioFinanceSummary(sessionUser.id, asOf),
    getPropertyFinanceRows(sessionUser.id, asOf),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Financial dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Rent due, rent received, arrears and monthly-equivalent cashflow across the portfolio.
        </p>
        <div className="mt-4">
          <Link href="/finance/reporting" className="btn btn-secondary btn-sm">
            Reporting & accountant pack
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Contracted monthly-equivalent rent", money(summary.monthlyContractedRent), "text-green-700"],
          ["Due this month", money(summary.scheduledThisMonth), "text-slate-900"],
          [
            "Cash received this month",
            money(summary.cashReceivedThisMonth),
            summary.cashReceivedThisMonth > 0 ? "text-green-700" : "text-slate-900",
          ],
          [
            "Outstanding this month",
            money(summary.outstandingThisMonth),
            summary.outstandingThisMonth > 0 ? "text-red-700" : "text-green-700",
          ],
          [
            "Estimated net cashflow",
            money(summary.estimatedNetCashflow),
            summary.estimatedNetCashflow >= 0 ? "text-green-700" : "text-red-700",
          ],
        ].map(([title, value, tone]) => (
          <div key={title} className="rounded-xl border bg-white p-4">
            <div className="text-sm text-slate-500">{title}</div>
            <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Property performance this month</h2>
        <p className="mt-1 text-sm text-slate-500">As of {fmt(asOf)}</p>

        {!rows.length ? (
          <p className="mt-4 text-sm text-slate-500">No properties found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Property</th>
                  <th className="py-2 pr-4">Rent</th>
                  <th className="py-2 pr-4">Received</th>
                  <th className="py-2 pr-4">Overdue</th>
                  <th className="py-2 pr-4">Mortgage</th>
                  <th className="py-2 pr-4">Expenses</th>
                  <th className="py-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-3 pr-4">{row.name}</td>
                    <td className="py-3 pr-4">{money(row.contractedRent)}</td>
                    <td className="py-3 pr-4">{money(row.receivedThisMonth)}</td>
                    <td
                      className={`py-3 pr-4 ${
                        row.overdue > 0 ? "text-red-700" : "text-slate-700"
                      }`}
                    >
                      {money(row.overdue)}
                    </td>
                    <td className="py-3 pr-4">{money(row.mortgageMonthly)}</td>
                    <td className="py-3 pr-4">{money(row.expensesThisMonth)}</td>
                    <td
                      className={`py-3 ${
                        row.estimatedNetThisMonth >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {money(row.estimatedNetThisMonth)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Overdue payment lines</h2>
          <Link href="/tenancies" className="btn btn-secondary btn-sm">
            Open tenancies
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {summary.overduePayments.map((payment) => {
            const outstanding = Math.max(0, payment.amountDue - payment.amountPaid);
            const tenants =
              payment.tenancy.tenants.map((tt) => tt.tenant.fullName).join(", ") || "No tenants";

            return (
              <div key={payment.id} className="rounded-lg border border-slate-200 p-3">
                <div className="font-medium text-slate-900">{payment.tenancy.property.name}</div>
                <div className="text-sm text-slate-500">{tenants}</div>
                <div className="mt-1 text-sm text-slate-700">
                  Due {fmt(payment.dueDate)} · Outstanding {money(outstanding)}
                </div>
                <Link
                  href={`/tenancies/${payment.tenancyId}/payments#${payment.id}`}
                  className="mt-2 btn btn-secondary btn-sm"
                >
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
  );
}
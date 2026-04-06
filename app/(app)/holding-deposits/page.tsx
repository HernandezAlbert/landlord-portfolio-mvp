import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/applicants";
import { formatAppliedTo, formatHoldingDepositStatus } from "@/lib/holding-deposits";

function fmtDate(value?: Date | null) {
  if (!value) return "—";
  return value.toISOString().slice(0, 10);
}

export default async function HoldingDepositsPage() {
  const rows = await prisma.holdingDeposit.findMany({
    include: {
      applicant: {
        include: {
          property: true,
        },
      },
    },
    orderBy: [{ deadlineAt: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Holding deposits</h1>
        <p className="text-sm text-slate-600">
          Monitor live deposits, deadlines, refunds, retained amounts, and applications to rent/deposit.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-5">
        {!rows.length ? (
          <p className="text-sm text-slate-600">No holding deposits recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-2">Applicant</th>
                  <th className="px-3 py-2">Property</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Received</th>
                  <th className="px-3 py-2">Deadline</th>
                  <th className="px-3 py-2">Applied to</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="px-3 py-2">{row.applicant.fullName}</td>
                    <td className="px-3 py-2">{row.applicant.property?.name ?? "—"}</td>
                    <td className="px-3 py-2">{formatHoldingDepositStatus(row.status)}</td>
                    <td className="px-3 py-2">{formatMoney(row.amountReceivedPence ?? row.amountRequestedPence)}</td>
                    <td className="px-3 py-2">{fmtDate(row.receivedAt)}</td>
                    <td className="px-3 py-2">{fmtDate(row.deadlineAt)}</td>
                    <td className="px-3 py-2">{formatAppliedTo(row.appliedTo)}</td>
                    <td className="px-3 py-2">
                      <Link className="btn btn-secondary" href={`/applicants/${row.applicantId}/holding-deposit`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
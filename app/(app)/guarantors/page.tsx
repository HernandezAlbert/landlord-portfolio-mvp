import Link from "next/link";
import { prisma } from "@/lib/prisma";

function formatMoney(value?: number | null) {
  if (typeof value !== "number") return "—";
  return `£${(value / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB").format(value);
}

export default async function GuarantorsPage() {
  const guarantors = await prisma.guarantor.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      applicant: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Guarantors
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View and manage guarantor records.
          </p>
        </div>

        <Link
          href="/guarantors/new"
          className="inline-flex items-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add guarantor
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {guarantors.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No guarantors found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Applicant
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Annual income
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Deed
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {guarantors.map((guarantor) => {
                  const guarantorName =
                    guarantor.fullName?.trim() ||
                    `${guarantor.firstName} ${guarantor.lastName}`.trim();

                  const applicantName =
                    guarantor.applicant?.fullName?.trim() || "—";

                  return (
                    <tr key={guarantor.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {guarantorName}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        <div>{guarantor.email || "—"}</div>
                        <div>{guarantor.phone || "—"}</div>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {guarantor.applicant ? (
                          <Link
                            href={`/applicants/${guarantor.applicant.id}`}
                            className="hover:underline"
                          >
                            {applicantName}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {formatMoney(guarantor.annualIncomePence)}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {guarantor.deedSigned ? "Signed" : "Not signed"}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(guarantor.createdAt)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/guarantors/${guarantor.id}`}
                            className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Open
                          </Link>
                          <Link
                            href={`/guarantors/${guarantor.id}/edit`}
                            className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
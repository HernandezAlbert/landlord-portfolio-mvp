import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";
import { money as formatMoney } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { formatRentWithFrequency, getMonthlyEquivalentPence } from "@/lib/tenancy-rent";

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

function statusLabel(date: Date | null | undefined) {
  if (!date) return { label: "Not set", tone: "text-slate-500" };

  const diff = date.getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return {
      label: `Expired ${Math.abs(days)}d ago`,
      tone: "text-red-600",
    };
  }

  if (days <= 30) {
    return {
      label: `Due in ${days}d`,
      tone: "text-amber-600",
    };
  }

  return {
    label: "Current",
    tone: "text-emerald-600",
  };
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;

  const property = await prisma.property.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      mortgage: true,
      insurancePolicy: true,
      compliance: {
        where: { deletedAt: null },
        orderBy: { type: "asc" },
      },
      inspections: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      tenancies: {
        where: { deletedAt: null },
        include: {
          tenants: {
            include: {
              tenant: true,
            },
          },
          payments: {
            where: { deletedAt: null },
          },
        },
      },
      expenses: {
        where: { deletedAt: null },
        orderBy: { date: "desc" },
      },
      applicants: {
        where: {
          deletedAt: null,
          userId: user.id,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!property) redirect("/properties");

  const activeTenancies = property.tenancies.filter((t) => t.isActive);
  const activeMonthlyRent = activeTenancies.reduce(
    (sum, t) => sum + getMonthlyEquivalentPence(t),
    0,
  );
  const monthlyRent = property.advertisedRentMonthly ?? activeMonthlyRent;

  const now = new Date();
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  const dueThisMonth = activeTenancies.reduce(
    (sum, tenancy) =>
      sum +
      tenancy.payments
        .filter(
          (payment) =>
            payment.deletedAt === null &&
            payment.dueDate >= thisMonthStart &&
            payment.dueDate < nextMonthStart,
        )
        .reduce((s, payment) => s + payment.amountDue, 0),
    0,
  );

  const receivedThisMonth = property.tenancies.reduce(
    (sum, tenancy) =>
      sum +
      tenancy.payments
        .filter(
          (payment) =>
            payment.deletedAt === null &&
            payment.paidDate &&
            payment.paidDate >= thisMonthStart &&
            payment.paidDate < nextMonthStart,
        )
        .reduce((s, payment) => s + payment.amountPaid, 0),
    0,
  );

  const arrears = activeTenancies.reduce(
    (sum, tenancy) =>
      sum +
      tenancy.payments
        .filter(
          (payment) =>
            payment.deletedAt === null && payment.dueDate <= new Date(),
        )
        .reduce(
          (s, payment) => s + Math.max(0, payment.amountDue - payment.amountPaid),
          0,
        ),
    0,
  );

  const monthExpenses = property.expenses
    .filter(
      (expense) =>
        expense.date >= thisMonthStart && expense.date < nextMonthStart,
    )
    .reduce((sum, expense) => sum + expense.amount, 0);

  const mortgageMonthly = property.mortgage?.monthlyPayment ?? 0;
  const netThisMonth = receivedThisMonth - monthExpenses - mortgageMonthly;
  const propertyLicenceStatus = statusLabel(property.propertyLicenseExpiresOn);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {property.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {property.address1}, {property.city}, {property.postcode}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/properties/${property.id}/edit`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Edit
          </Link>
          <Link
            href="/properties"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Monthly rent</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatMoney(monthlyRent)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Tenancies</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {activeTenancies.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Mortgage</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {property.mortgage?.lender ?? "Not set"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Product end {fmt(property.mortgage?.productEndDate ?? null) || "Not set"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Property licence</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {property.propertyLicenseExpiresOn
              ? fmt(property.propertyLicenseExpiresOn)
              : "Not set"}
          </div>
          <div className={`mt-1 text-xs font-medium ${propertyLicenceStatus.tone}`}>
            {propertyLicenceStatus.label}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Due this month</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatMoney(dueThisMonth)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Received this month</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatMoney(receivedThisMonth)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Arrears</div>
          <div
            className={`mt-2 text-2xl font-semibold ${
              arrears > 0 ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {formatMoney(arrears)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Est. net this month</div>
          <div
            className={`mt-2 text-2xl font-semibold ${
              netThisMonth >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatMoney(netThisMonth)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Mortgage</h2>
            <Link
              href={`/properties/${property.id}/edit`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Manage
            </Link>
          </div>

          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-medium">Lender:</span>{" "}
              {property.mortgage?.lender ?? "Not set"}
            </p>
            <p>
              <span className="font-medium">Monthly payment:</span>{" "}
              {property.mortgage?.monthlyPayment != null
                ? formatMoney(property.mortgage.monthlyPayment)
                : "Not set"}
            </p>
            <p>
              <span className="font-medium">Product end:</span>{" "}
              {property.mortgage?.productEndDate
                ? fmt(property.mortgage.productEndDate)
                : "Not set"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Insurance</h2>
            <Link
              href={`/properties/${property.id}/edit`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Manage
            </Link>
          </div>

          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-medium">Provider:</span>{" "}
              {property.insurancePolicy?.provider ?? "Not set"}
            </p>
            <p>
              <span className="font-medium">Renewal:</span>{" "}
              {property.insurancePolicy?.renewalDate
                ? fmt(property.insurancePolicy.renewalDate)
                : "Not set"}
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Compliance</h2>
          <Link
            href={`/properties/${property.id}/edit`}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Manage
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {["GAS", "EICR", "EPC"].map((type) => {
            const item = property.compliance.find((c) => c.type === type);
            const status = statusLabel(item?.expiresOn);

            return (
              <div
                key={type}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="text-sm font-semibold text-slate-900">{type}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {item?.expiresOn ? fmt(item.expiresOn) : "Not set"}
                </div>
                <div className={`mt-2 text-xs font-medium ${status.tone}`}>
                  {status.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Licence</div>
            <div className="mt-1 text-sm text-slate-600">
              {property.propertyLicenseExpiresOn
                ? fmt(property.propertyLicenseExpiresOn)
                : "Not set"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Inspection</div>
            <div className="mt-1 text-sm text-slate-600">
              {property.inspections[0]?.nextDue
                ? fmt(property.inspections[0].nextDue)
                : "Not set"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Current tenants</h2>
          <Link
            href="/tenancies/new"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            + New Tenancy
          </Link>
        </div>

        {activeTenancies.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-medium">Tenant</th>
                  <th className="px-3 py-2 font-medium">Rent</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {activeTenancies.flatMap((t) =>
                  t.tenants.map((tt) => (
                    <tr key={`${t.id}-${tt.tenantId}`} className="border-b border-slate-100">
                      <td className="px-3 py-3 text-slate-900">
                        {tt.tenant.fullName}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {formatRentWithFrequency(t)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/tenancies/${t.id}`}
                          className="text-sm font-medium text-slate-700 hover:text-slate-900"
                        >
                          Open tenancy
                        </Link>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No active tenancies.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Recent applicants</h2>
          <Link
            href="/applicants"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            View all
          </Link>
        </div>

        {property.applicants.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-medium">Applicant</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Submitted</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {property.applicants.map((applicant) => (
                  <tr key={applicant.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 text-slate-900">{applicant.fullName}</td>
                    <td className="px-3 py-3 text-slate-700">{applicant.status}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {fmt(applicant.importSubmittedAt ?? applicant.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/applicants/${applicant.id}`}
                        className="text-sm font-medium text-slate-700 hover:text-slate-900"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            No applicants yet for this property.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Recent expenses</h2>
          <Link
            href="/expenses/new"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            + Add expense
          </Link>
        </div>

        {property.expenses.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {property.expenses.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 text-slate-700">{fmt(e.date)}</td>
                    <td className="px-3 py-3 text-slate-700">{e.category}</td>
                    <td className="px-3 py-3 text-slate-900">
                      {formatMoney(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No expenses recorded yet.</p>
        )}
      </section>
    </div>
  );
}
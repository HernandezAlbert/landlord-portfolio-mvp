import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TenancyTableRow from "@/components/TenancyTableRow";

function money(pence: number | null | undefined) {
  return `£${(((pence ?? 0) as number) / 100).toFixed(2)}`;
}

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function TenanciesPage() {
  const tenancies = await prisma.tenancy.findMany({
    where: { deletedAt: null },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: {
      property: true,
      tenants: {
        include: {
          tenant: true,
        },
      },
      payments: {
        where: { deletedAt: null },
        orderBy: { dueDate: "desc" },
        take: 12,
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenancies</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage active and historic tenancies, rent and arrears.
          </p>
        </div>

        <Link
          href="/tenancies/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New Tenancy
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Tenant(s)</th>
              <th className="px-4 py-3 font-medium">Start</th>
              <th className="px-4 py-3 font-medium">Rent</th>
              <th className="px-4 py-3 font-medium">Arrears</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {tenancies.map((t) => {
              const tenantNames =
                t.tenants
                  .filter((tt) => !tt.tenant.deletedAt)
                  .map((tt) => tt.tenant.fullName)
                  .join(", ") || "No tenants";

              const arrears = t.payments
                .filter((p) => p.dueDate <= new Date())
                .reduce((sum, p) => sum + Math.max(0, p.amountDue - p.amountPaid), 0);

              return (
                <TenancyTableRow
                  key={t.id}
                  id={t.id}
                  propertyName={t.property?.name ?? "—"}
                  tenantNames={tenantNames}
                  startDate={fmt(t.startDate)}
                  rentLabel={money(t.rentMonthly)}
                  arrearsLabel={money(arrears)}
                  arrearsValue={arrears}
                  statusLabel={t.isActive ? "Active" : "Archived"}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
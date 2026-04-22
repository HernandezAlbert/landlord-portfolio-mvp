import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import { formatRentWithFrequency } from "@/lib/tenancy-rent";

export default async function TenanciesPage() {
  const user = await requireSessionUser();

  const tenancies = await prisma.tenancy.findMany({
    where: {
      deletedAt: null,
      property: {
        userId: user.id,
        deletedAt: null,
      },
    },
    include: {
      property: true,
      tenants: {
        include: {
          tenant: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenancies</h1>

        <Link href="/tenancies/new" className="btn btn-primary">
          + New Tenancy
        </Link>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Property</th>
              <th className="p-3">Tenants</th>
              <th className="p-3">Rent</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {tenancies.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3">{t.property.name}</td>

                <td className="p-3">
                  {t.tenants.map((tt) => tt.tenant.fullName).join(", ")}
                </td>

                <td className="p-3">{formatRentWithFrequency(t)}</td>

                <td className="p-3">
                  {t.isActive ? "Active" : "Ended"}
                </td>

                <td className="p-3">
                  <Link
                    href={`/tenancies/${t.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}

            {!tenancies.length && (
              <tr>
                <td colSpan={5} className="p-4 text-slate-500">
                  No tenancies yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
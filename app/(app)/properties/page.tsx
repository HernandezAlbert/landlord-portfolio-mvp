import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PropertyTableRow from "@/components/PropertyTableRow";

function formatDate(d?: Date | null) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function PropertiesPage() {
  const props = await prisma.property.findMany({
    where: { deletedAt: null },
    include: { mortgage: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage properties, mortgages, compliance and inspections.
          </p>
        </div>

        <Link
          href="/properties/new"
          className="btn btn-primary"
        >
          + New Property
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Advertised Rent</th>
              <th className="px-4 py-3 font-medium">Mortgage</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {props.map((p) => (
              <PropertyTableRow
                key={p.id}
                id={p.id}
                name={p.name}
                address={`${p.address1}, ${p.city}, ${p.postcode}`}
                rentLabel={p.advertisedRentMonthly ? `£${(p.advertisedRentMonthly / 100).toFixed(2)}` : "Not set"}
                mortgageLabel={
                  p.mortgage?.lender
                    ? `${p.mortgage.lender}${
                        formatDate(p.mortgage.productEndDate)
                          ? ` • ends ${formatDate(p.mortgage.productEndDate)}`
                          : ""
                      }`
                    : "Not set"
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
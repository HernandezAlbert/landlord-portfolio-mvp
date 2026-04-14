import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PropertyTableRow from "@/components/PropertyTableRow";
import { requireSessionUser } from "@/lib/auth";
import { money as formatMoney } from "@/lib/finance";

export default async function PropertiesPage() {
  const user = await requireSessionUser();

  const props = await prisma.property.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    include: { mortgage: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-sm text-slate-500">
            Manage properties, mortgages, compliance and inspections.
          </p>
        </div>

        <Link href="/properties/new" className="btn btn-primary">
          + New Property
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">Property</th>
              <th className="p-3 text-left">Address</th>
              <th className="p-3 text-left">Advertised Rent</th>
              <th className="p-3 text-left">Mortgage</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {props.map((p) => (
              <PropertyTableRow
                key={p.id}
                id={p.id}
                name={p.name}
                address={`${p.address1}, ${p.city}, ${p.postcode}`}
                rentLabel={
                  typeof p.advertisedRentMonthly === "number"
                    ? formatMoney(p.advertisedRentMonthly)
                    : "Not set"
                }
                mortgageLabel={p.mortgage?.lender ?? "Not set"}
              />
            ))}

            {!props.length && (
              <tr className="border-t">
                <td className="p-4 text-slate-500" colSpan={5}>
                  No properties yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
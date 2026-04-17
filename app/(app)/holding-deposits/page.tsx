// app/(app)/holding-deposits/page.tsx

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";

export default async function HoldingDepositsPage() {
  const user = await requireSessionUser();

  const deposits = await prisma.holdingDeposit.findMany({
    where: {
      applicant: {
        userId: user.id,
      },
    },
    include: {
      applicant: {
        include: {
          property: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Holding Deposits</h1>

        <Link href="/applicants" className="btn btn-primary">
          View Applicants
        </Link>
      </div>

      {deposits.length === 0 ? (
        <div className="rounded border p-4">No holding deposits found.</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Applicant</th>
                <th className="p-3">Property</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>

            <tbody>
              {deposits.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-3">{item.applicant?.fullName || "-"}</td>
                  <td className="p-3">
                    {item.applicant?.property?.address1 || "-"}
                  </td>
                  <td className="p-3">{item.status}</td>
                  <td className="p-3">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
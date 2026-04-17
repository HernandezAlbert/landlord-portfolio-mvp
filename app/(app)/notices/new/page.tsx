// app/(app)/notices/new/page.tsx

import { redirect } from "next/navigation";
import { NoticeMethod, NoticeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";

export default async function NewNoticePage() {
  const user = await requireSessionUser();

  async function createNotice(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const tenancyId = String(formData.get("tenancyId") || "");

    const tenancy = await prisma.tenancy.findFirst({
      where: {
        id: tenancyId,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
    });

    if (!tenancy) {
      throw new Error("Invalid tenancy");
    }

    await prisma.notice.create({
      data: {
        tenancyId,
        type: String(formData.get("type")) as NoticeType,
        method: String(formData.get("method")) as NoticeMethod,
        notes: String(formData.get("notes") || ""),
        dateServed: new Date(String(formData.get("dateServed"))),
      },
    });

    redirect("/notices");
  }

  const tenancies = await prisma.tenancy.findMany({
    where: {
      deletedAt: null,
      property: {
        deletedAt: null,
        userId: user.id,
      },
    },
    include: {
      property: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">New Notice</h1>

      <form action={createNotice} className="space-y-4">
        <div>
          <label className="block mb-1">Tenancy</label>
          <select name="tenancyId" className="w-full border rounded p-2" required>
            <option value="">Select tenancy</option>
            {tenancies.map((tenancy) => (
              <option key={tenancy.id} value={tenancy.id}>
                {tenancy.property.address1}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Type</label>
          <select name="type" className="w-full border rounded p-2" required>
            {Object.values(NoticeType).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Date Served</label>
          <input
            type="date"
            name="dateServed"
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Method</label>
          <select name="method" className="w-full border rounded p-2" required>
            {Object.values(NoticeMethod).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Notes</label>
          <textarea name="notes" className="w-full border rounded p-2" rows={4} />
        </div>

        <button className="btn btn-primary">Save Notice</button>
      </form>
    </div>
  );
}
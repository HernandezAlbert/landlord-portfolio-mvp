// app/(app)/expenses/new/page.tsx

import { redirect } from "next/navigation";
import { ExpenseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";

export default async function NewExpensePage() {
  const user = await requireSessionUser();

  async function createExpense(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const propertyId = String(formData.get("propertyId") || "");

    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        userId: currentUser.id,
        deletedAt: null,
      },
    });

    if (!property) {
      throw new Error("Invalid property");
    }

    await prisma.expense.create({
      data: {
        propertyId,
        category: String(formData.get("category")) as ExpenseCategory,
        notes: String(formData.get("notes") || ""),
        amount: Number(formData.get("amount") || 0),
        date: new Date(String(formData.get("date"))),
      },
    });

    redirect("/expenses");
  }

  const properties = await prisma.property.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">New Expense</h1>

      <form action={createExpense} className="space-y-4">
        <div>
          <label className="block mb-1">Property</label>
          <select
            name="propertyId"
            className="w-full border rounded p-2"
            required
          >
            <option value="">Select property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Date</label>
          <input
            type="date"
            name="date"
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Category</label>
          <select
            name="category"
            className="w-full border rounded p-2"
            required
          >
            {Object.values(ExpenseCategory).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            name="amount"
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Notes</label>
          <textarea
            name="notes"
            rows={4}
            className="w-full border rounded p-2"
          />
        </div>

        <button className="btn btn-primary">Save Expense</button>
      </form>
    </div>
  );
}
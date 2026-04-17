// app/(app)/expenses/[id]/edit/page.tsx

import { notFound, redirect } from "next/navigation";
import { ExpenseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import ConfirmSubmit from "@/components/ConfirmSubmit";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;

  const expense = await prisma.expense.findFirst({
    where: {
      id,
      deletedAt: null,
      property: {
        userId: user.id,
      },
    },
    include: {
      property: true,
    },
  });

  if (!expense) {
    notFound();
  }

  async function updateExpense(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    await prisma.expense.updateMany({
      where: {
        id,
        property: {
          userId: currentUser.id,
        },
      },
      data: {
        category: String(formData.get("category")) as ExpenseCategory,
        notes: String(formData.get("notes") || ""),
        amount: Number(formData.get("amount") || 0),
        date: new Date(String(formData.get("date"))),
      },
    });

    redirect("/expenses");
  }

  async function deleteExpense() {
    "use server";

    const currentUser = await requireSessionUser();

    await prisma.expense.updateMany({
      where: {
        id,
        property: {
          userId: currentUser.id,
        },
      },
      data: {
        deletedAt: new Date(),
      },
    });

    redirect("/expenses");
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Edit Expense</h1>

      <form action={updateExpense} className="space-y-4">
        <div>
          <label className="block mb-1">Property</label>
          <input
            value={expense.property.name}
            disabled
            className="w-full border rounded p-2 bg-muted"
          />
        </div>

        <div>
          <label className="block mb-1">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={new Date(expense.date)
              .toISOString()
              .slice(0, 10)}
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Category</label>
          <select
            name="category"
            defaultValue={expense.category}
            className="w-full border rounded p-2"
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
            defaultValue={Number(expense.amount || 0).toFixed(2)}
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Notes</label>
          <textarea
            name="notes"
            rows={4}
            defaultValue={expense.notes || ""}
            className="w-full border rounded p-2"
          />
        </div>

        <button className="btn btn-primary">Save Changes</button>
      </form>

      <form action={deleteExpense}>
        <ConfirmSubmit>Delete Expense</ConfirmSubmit>
      </form>
    </div>
  );
}
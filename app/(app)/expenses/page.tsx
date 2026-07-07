// app/(app)/expenses/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { formatGBPFromPence } from "@/lib/money";

export default async function ExpensesPage() {
  const user = await requireSessionUser();

  async function deleteExpense(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const expenseId = String(formData.get("expenseId") || "");

    await prisma.expense.updateMany({
      where: {
        id: expenseId,
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

  const expenses = await prisma.expense.findMany({
    where: {
      deletedAt: null,
      property: {
        userId: user.id,
      },
    },
    include: {
      property: true,
    },
    orderBy: {
      date: "desc",
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Expenses</h1>

        <Link href="/expenses/new" className="btn btn-primary">
          Add Expense
        </Link>
      </div>

      {expenses.length === 0 ? (
        <div className="rounded border p-4">No expenses found.</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Date</th>
                <th className="p-3">Property</th>
                <th className="p-3">Category</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b">
                  <td className="p-3">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="p-3">{expense.property.name}</td>
                  <td className="p-3">{expense.category}</td>
                  <td className="p-3">{formatGBPFromPence(expense.amount)}</td>
                  <td className="p-3">{expense.notes || "-"}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/expenses/${expense.id}/edit`}
                        className="btn btn-secondary"
                      >
                        Edit
                      </Link>

                      <form action={deleteExpense}>
                        <input
                          type="hidden"
                          name="expenseId"
                          value={expense.id}
                        />
                        <ConfirmSubmit>Delete</ConfirmSubmit>
                      </form>
                    </div>
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

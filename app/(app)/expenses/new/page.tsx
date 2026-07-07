import Link from "next/link";
import { ExpenseCategory } from "@prisma/client";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";
import { poundsToPence } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const inputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

const labelClassName = "mb-1 block text-sm font-semibold text-slate-800";

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
        amount: poundsToPence(formData.get("amount")),
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          New Expense
        </h1>
      </div>

      <form
        action={createExpense}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClassName} htmlFor="propertyId">
              Property
            </label>
            <select
              id="propertyId"
              name="propertyId"
              className={inputClassName}
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select property
              </option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClassName} htmlFor="date">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              className={inputClassName}
              required
            />
          </div>

          <div>
            <label className={labelClassName} htmlFor="category">
              Category
            </label>
            <select
              id="category"
              name="category"
              className={inputClassName}
              required
              defaultValue={ExpenseCategory.REPAIRS}
            >
              {Object.values(ExpenseCategory).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClassName} htmlFor="amount">
              Amount
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              className={inputClassName}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClassName} htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              className={inputClassName}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Link
            href="/expenses"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </Link>

          <button className="btn btn-primary">Save Expense</button>
        </div>
      </form>
    </div>
  );
}

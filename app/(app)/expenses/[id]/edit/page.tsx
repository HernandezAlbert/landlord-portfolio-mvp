import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";
import {
  deleteExpenseReceiptByPath,
  saveExpenseReceipt,
} from "@/lib/expense-receipts";

const EXPENSE_CATEGORIES = [
  "REPAIRS",
  "MAINTENANCE",
  "INSURANCE",
  "UTILITIES",
  "MORTGAGE_INTEREST",
  "SERVICE_CHARGE",
  "MANAGEMENT",
  "FEES",
  "OTHER",
] as const;

function fmtDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [expense, properties] = await Promise.all([
    prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: { property: true },
    }),
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!expense) redirect("/expenses");

  const expenseItem = expense;

  async function updateExpense(formData: FormData) {
    "use server";

    const propertyId = String(formData.get("propertyId") ?? "").trim();
    const date = String(formData.get("date") ?? "").trim();
    const amountPounds = Number(formData.get("amount") ?? 0);
    const category = String(formData.get("category") ?? expenseItem.category);
    const vendor = String(formData.get("vendor") ?? "").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const replaceReceipt = formData.get("replaceReceipt") === "on";
    const removeReceipt = formData.get("removeReceipt") === "on";
    const receipt = formData.get("receipt");

    if (!propertyId || !date || !amountPounds) {
      redirect(`/expenses/${id}/edit`);
    }

    let receiptPath = expenseItem.receiptPath;
    let receiptStoragePath = expenseItem.receiptStoragePath;
    let receiptOriginalName = expenseItem.receiptOriginalName;

    if (removeReceipt) {
      await deleteExpenseReceiptByPath(
        expenseItem.receiptPath,
        expenseItem.receiptStoragePath
      );
      receiptPath = null;
      receiptStoragePath = null;
      receiptOriginalName = null;
    }

    const incomingFile = receipt instanceof File && receipt.size ? receipt : null;

    if (incomingFile && (replaceReceipt || !expenseItem.receiptPath)) {
      await deleteExpenseReceiptByPath(
        expenseItem.receiptPath,
        expenseItem.receiptStoragePath
      );

      const receiptData = await saveExpenseReceipt(incomingFile);
      receiptPath = receiptData?.receiptPath || null;
      receiptStoragePath = receiptData?.receiptStoragePath || null;
      receiptOriginalName = receiptData?.receiptOriginalName || null;
    }

    await prisma.expense.update({
      where: { id },
      data: {
        propertyId,
        date: new Date(date),
        amount: Math.round(amountPounds * 100),
        category: category as any,
        vendor: vendor || null,
        reference: reference || null,
        notes: notes || null,
        receiptPath,
        receiptStoragePath,
        receiptOriginalName,
      },
    });

    redirect("/expenses");
  }

  async function deleteExpense() {
    "use server";

    await prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await deleteExpenseReceiptByPath(
      expenseItem.receiptPath,
      expenseItem.receiptStoragePath
    );

    redirect("/expenses");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit expense</h1>
        <a href="/expenses" className="text-sm underline">
          Back
        </a>
      </div>

      <form
        action={updateExpense}
        className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Property</span>
            <select
              name="propertyId"
              defaultValue={expenseItem.propertyId}
              className="rounded-xl border px-3 py-2"
              required
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span>Date</span>
            <input
              type="date"
              name="date"
              defaultValue={fmtDateInput(expenseItem.date)}
              className="rounded-xl border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Amount (£)</span>
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0"
              defaultValue={(expenseItem.amount / 100).toFixed(2)}
              className="rounded-xl border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Category</span>
            <select
              name="category"
              defaultValue={expenseItem.category}
              className="rounded-xl border px-3 py-2"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span>Vendor (optional)</span>
            <input
              name="vendor"
              defaultValue={expenseItem.vendor ?? ""}
              className="rounded-xl border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Reference (optional)</span>
            <input
              name="reference"
              defaultValue={expenseItem.reference ?? ""}
              className="rounded-xl border px-3 py-2"
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span>Notes</span>
          <textarea
            name="notes"
            defaultValue={expenseItem.notes ?? ""}
            className="min-h-28 rounded-xl border px-3 py-2"
          />
        </label>

        <div className="grid gap-3 rounded-xl border p-4">
          <div className="text-sm font-medium">Receipt</div>

          {expenseItem.receiptPath ? (
            <div className="text-sm">
              <a
                href={expenseItem.receiptPath}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                View current receipt
              </a>{" "}
              <span className="text-slate-500">
                {expenseItem.receiptOriginalName || "Saved receipt"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No receipt attached.</p>
          )}

          <label className="grid gap-1 text-sm">
            <span>Upload replacement receipt</span>
            <input type="file" name="receipt" className="rounded-xl border px-3 py-2" />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="replaceReceipt" />
            <span>Replace current receipt if a new file is selected</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="removeReceipt" />
            <span>Remove current receipt</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Save changes
          </button>

          <a href="/expenses" className="rounded-xl border px-4 py-2 text-sm font-medium">
            Cancel
          </a>
        </div>
      </form>

      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <h2 className="text-lg font-semibold text-red-800">Danger zone</h2>
        <p className="mt-1 text-sm text-red-700">
          Delete this expense from active lists.
        </p>

        <form action={deleteExpense} className="mt-4">
          <ConfirmSubmit
            title="Delete expense?"
            description="This will hide the expense from active lists."
            confirmText="Delete expense"
          >
            <button
              type="submit"
              className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700"
            >
              Delete expense
            </button>
          </ConfirmSubmit>
        </form>
      </div>
    </div>
  );
}
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { saveExpenseReceipt } from "@/lib/expense-receipts";

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

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams?: Promise<{ propertyId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedPropertyId = resolvedSearchParams?.propertyId ?? "";

  const properties = await prisma.property.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  async function createExpense(formData: FormData) {
    "use server";

    const propertyId = String(formData.get("propertyId") ?? "").trim();
    const date = String(formData.get("date") ?? "").trim();
    const amountPounds = Number(formData.get("amount") ?? 0);
    const category = String(formData.get("category") ?? "OTHER");
    const vendor = String(formData.get("vendor") ?? "").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const receipt = formData.get("receipt");

    if (!propertyId || !date || !amountPounds) {
      redirect("/expenses/new");
    }

    const receiptData = await saveExpenseReceipt(
      receipt instanceof File ? receipt : null
    );

    await prisma.expense.create({
      data: {
        propertyId,
        date: new Date(date),
        amount: Math.round(amountPounds * 100),
        category: category as any,
        vendor: vendor || null,
        reference: reference || null,
        notes: notes || null,
        receiptPath: receiptData?.receiptPath || null,
        receiptStoragePath: receiptData?.receiptStoragePath || null,
        receiptOriginalName: receiptData?.receiptOriginalName || null,
      },
    });

    redirect("/expenses");
  }

  return (
    <div className="grid gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">New expense</h1>
        <a href="/expenses">← Back</a>
      </div>

      <form
        action={createExpense}
        className="grid gap-4 rounded-xl border bg-white p-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm md:col-span-2">
            <span>Property</span>
            <select
              name="propertyId"
              defaultValue={selectedPropertyId}
              className="rounded border px-3 py-2"
              required
            >
              <option value="">Select property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span>Date</span>
            <input
              type="date"
              name="date"
              defaultValue={fmtDate(new Date())}
              className="rounded border px-3 py-2"
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
              className="rounded border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Category</span>
            <select
              name="category"
              defaultValue="OTHER"
              className="rounded border px-3 py-2"
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span>Vendor (optional)</span>
            <input
              name="vendor"
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Reference (optional)</span>
            <input
              name="reference"
              className="rounded border px-3 py-2"
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span>Notes</span>
          <textarea
            name="notes"
            rows={4}
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Receipt (optional)</span>
          <input
            type="file"
            name="receipt"
            className="rounded border px-3 py-2"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Create expense
          </button>
          <a href="/expenses" className="rounded-lg border px-4 py-2">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
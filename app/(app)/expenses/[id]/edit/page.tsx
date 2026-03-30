import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";
import { deleteExpenseReceiptByPath, saveExpenseReceipt } from "@/lib/expense-receipts";

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

export default async function EditExpensePage({ params }: { params: { id: string } }) {
  const [expense, properties] = await Promise.all([
    prisma.expense.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { property: true },
    }),
    prisma.property.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
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

    if (!propertyId || !date || !amountPounds) redirect(`/expenses/${params.id}/edit`);

    let receiptPath = expenseItem.receiptPath;
    let receiptStoragePath = expenseItem.receiptStoragePath;
    let receiptOriginalName = expenseItem.receiptOriginalName;

    if (removeReceipt) {
      await deleteExpenseReceiptByPath(expenseItem.receiptPath, expenseItem.receiptStoragePath);
      receiptPath = null;
      receiptStoragePath = null;
      receiptOriginalName = null;
    }

    const incomingFile = receipt instanceof File && receipt.size ? receipt : null;
    if (incomingFile && (replaceReceipt || !expenseItem.receiptPath)) {
      await deleteExpenseReceiptByPath(expenseItem.receiptPath, expenseItem.receiptStoragePath);
      const receiptData = await saveExpenseReceipt(incomingFile);
      receiptPath = receiptData?.receiptPath || null;
      receiptStoragePath = receiptData?.receiptStoragePath || null;
      receiptOriginalName = receiptData?.receiptOriginalName || null;
    }

    await prisma.expense.update({
      where: { id: params.id },
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
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });
    await deleteExpenseReceiptByPath(expenseItem.receiptPath, expenseItem.receiptStoragePath);
    redirect("/expenses");
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Edit expense</h1>
        <a href="/expenses" className="btn btn-secondary btn-sm">
          Back
        </a>
      </div>

      <form action={updateExpense} style={{ display: "grid", gap: 10, border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <label>
            Property
            <select name="propertyId" defaultValue={expenseItem.propertyId} style={{ width: "100%" }}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" name="date" defaultValue={fmtDateInput(expenseItem.date)} style={{ width: "100%" }} />
          </label>
          <label>
            Amount (£)
            <input type="number" step="0.01" name="amount" defaultValue={(expenseItem.amount / 100).toFixed(2)} style={{ width: "100%" }} />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <label>
            Category
            <select name="category" defaultValue={expenseItem.category} style={{ width: "100%" }}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vendor (optional)
            <input name="vendor" defaultValue={expenseItem.vendor ?? ""} style={{ width: "100%" }} />
          </label>
          <label>
            Reference (optional)
            <input name="reference" defaultValue={expenseItem.reference ?? ""} style={{ width: "100%" }} />
          </label>
        </div>

        <label>
          Notes
          <input name="notes" defaultValue={expenseItem.notes ?? ""} style={{ width: "100%" }} />
        </label>

        <div style={{ display: "grid", gap: 10, border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700 }}>Receipt</div>
          {expenseItem.receiptPath ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <a href={expenseItem.receiptPath} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                View current receipt
              </a>
              <span style={{ opacity: 0.8 }}>{expenseItem.receiptOriginalName || "Saved receipt"}</span>
            </div>
          ) : (
            <div style={{ opacity: 0.7 }}>No receipt attached.</div>
          )}
          <label>
            Upload replacement receipt
            <input type="file" name="receipt" accept=".pdf,image/*" style={{ width: "100%" }} />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="replaceReceipt" /> Replace current receipt if a new file is selected
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="removeReceipt" /> Remove current receipt
          </label>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" className="btn btn-primary">
            Save changes
          </button>
          <a href="/expenses" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </form>

      <section style={{ border: "1px solid #f2c2c2", borderRadius: 8, padding: 12, background: "#fff7f7" }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Danger zone</h2>
        <p style={{ marginTop: 6, opacity: 0.8 }}>Delete this expense from active lists.</p>
        <form action={deleteExpense}>
          <ConfirmSubmit className="btn btn-secondary btn-sm" confirmMessage="Delete this expense?">
            Delete expense
          </ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";
import { deleteExpenseReceiptByPath, saveExpenseReceipt } from "@/lib/expense-receipts";

function money(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

function getCurrentTaxYearRange() {
  const now = new Date();
  const year = now.getUTCMonth() > 3 || (now.getUTCMonth() === 3 && now.getUTCDate() >= 6)
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1;

  const start = new Date(Date.UTC(year, 3, 6, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 3, 6, 0, 0, 0, 0));
  return { start, end, label: `${year}/${String(year + 1).slice(-2)}` };
}

const EXPENSE_CATEGORIES = ["REPAIRS", "MAINTENANCE", "INSURANCE", "UTILITIES", "MORTGAGE_INTEREST", "SERVICE_CHARGE", "MANAGEMENT", "FEES", "OTHER"];

export default async function ExpensesPage() {
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();
  const { start: taxYearStart, end: taxYearEnd, label: taxYearLabel } = getCurrentTaxYearRange();

  const [properties, expenses, monthTotal, taxYearTotal] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.expense.findMany({
      where: { deletedAt: null, property: { deletedAt: null } },
      select: {
        id: true,
        date: true,
        category: true,
        amount: true,
        vendor: true,
        notes: true,
        receiptPath: true,
        receiptStoragePath: true,
        property: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.expense.aggregate({
      where: {
        deletedAt: null,
        date: { gte: monthStart, lt: monthEnd },
        property: { deletedAt: null },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        deletedAt: null,
        date: { gte: taxYearStart, lt: taxYearEnd },
        property: { deletedAt: null },
      },
      _sum: { amount: true },
    }),
  ]);

  async function addExpense(formData: FormData) {
    "use server";
    const propertyId = String(formData.get("propertyId") ?? "");
    const date = String(formData.get("date") ?? "").trim();
    const amountPounds = Number(formData.get("amount") ?? 0);
    const category = String(formData.get("category") ?? "OTHER");
    const vendor = String(formData.get("vendor") ?? "").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const receipt = formData.get("receipt");

    if (!propertyId || !date || !amountPounds) redirect("/expenses");

    const receiptData = await saveExpenseReceipt(receipt instanceof File ? receipt : null);

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

  async function deleteExpense(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) redirect("/expenses");
    const existing = await prisma.expense.findUnique({ where: { id }, select: { receiptPath: true, receiptStoragePath: true } });
    await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await deleteExpenseReceiptByPath(existing?.receiptPath, existing?.receiptStoragePath);
    redirect("/expenses");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Expenses</h1>

        <a href="/expenses/new" className="btn btn-primary">
          + Add Expense
        </a>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Expenses</h1>
      <p style={{ margin: 0, opacity: 0.75 }}>Track repairs/maintenance/fees and see month and tax-year totals using the expense date.</p>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <strong>This month:</strong> {money(monthTotal._sum.amount ?? 0)}
        </div>
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <strong>Current tax year ({taxYearLabel}):</strong> {money(taxYearTotal._sum.amount ?? 0)}
        </div>
      </div>

      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, maxWidth: 980 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Add expense</h2>
        <form action={addExpense} style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label>
              Property
              <select name="propertyId" style={{ width: "100%" }}>
                <option value="">Select…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input type="date" name="date" style={{ width: "100%" }} />
            </label>
            <label>
              Amount (£)
              <input type="number" step="0.01" name="amount" style={{ width: "100%" }} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label>
              Category
              <select name="category" style={{ width: "100%" }}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vendor (optional)
              <input name="vendor" style={{ width: "100%" }} />
            </label>
            <label>
              Reference (optional)
              <input name="reference" style={{ width: "100%" }} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <label>
              Notes
              <input name="notes" style={{ width: "100%" }} />
            </label>
            <label>
              Receipt (optional)
              <input type="file" name="receipt" accept=".pdf,image/*" style={{ width: "100%" }} />
            </label>
          </div>

          <button type="submit" className="btn btn-primary">Add expense</button>
        </form>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Recent expenses</h2>
          <span style={{ fontSize: 13, opacity: 0.7 }}>Showing latest {expenses.length} by expense date</span>
        </div>
        <table cellPadding={10} style={{ borderCollapse: "collapse", width: "100%", marginTop: 8 }}>
          <thead>
            <tr>
              <th align="left">Date</th>
              <th align="left">Property</th>
              <th align="left">Category</th>
              <th align="left">Amount</th>
              <th align="left">Vendor</th>
              <th align="left">Notes</th>
              <th align="left">Receipt</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid #eee" }}>
                <td>{fmt(e.date)}</td>
                <td>{e.property.name}</td>
                <td>{e.category}</td>
                <td>{money(e.amount)}</td>
                <td>{e.vendor ?? ""}</td>
                <td style={{ maxWidth: 260 }}>{e.notes ?? ""}</td>
                <td>
                  {e.receiptPath ? (
                    <a href={e.receiptPath} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                      View receipt
                    </a>
                  ) : ""}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link href={`/expenses/${e.id}/edit`} className="btn btn-secondary btn-sm">
                      Edit
                    </Link>
                    <form action={deleteExpense}>
                      <input type="hidden" name="id" value={e.id} />
                      <ConfirmSubmit className="btn btn-secondary btn-sm" confirmMessage="Delete this expense?">
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={8} style={{ paddingTop: 12, opacity: 0.7 }}>
                  No expenses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

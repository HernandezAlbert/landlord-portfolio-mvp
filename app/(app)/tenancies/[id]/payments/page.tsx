import { prisma } from "@/lib/prisma";
import { getTenancyArrears } from "@/lib/arrears";
import { getPaymentStatus, ensureRentScheduleForTenancy } from "@/lib/rent";
import { money } from "@/lib/finance";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

function fmt(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function TenancyPaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureRentScheduleForTenancy(id, new Date());

  const tenancy = await prisma.tenancy.findFirst({
    where: { id, deletedAt: null },
    include: {
      property: true,
      tenants: { include: { tenant: true } },
      payments: {
        where: { deletedAt: null },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  if (!tenancy) redirect("/tenancies");

  const today = new Date();
  const arrears = await getTenancyArrears(id, today);
  const tenantNames = tenancy.tenants.map((tt) => tt.tenant.fullName).join(", ") || "No tenants";

  async function addPaymentLine(formData: FormData) {
    "use server";
    const dueDate = String(formData.get("dueDate") ?? "").trim();
    const amountDue = Number(formData.get("amountDue") ?? 0);
    const amountPaid = Number(formData.get("amountPaid") ?? 0);
    const paidDate = String(formData.get("paidDate") ?? "").trim();
    const method = String(formData.get("method") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    if (!dueDate || !amountDue) redirect(`/tenancies/${id}/payments`);

    await prisma.payment.create({
      data: {
        tenancyId: id,
        dueDate: new Date(dueDate),
        amountDue: Math.round(amountDue * 100),
        amountPaid: Math.round((amountPaid || 0) * 100),
        paidDate: paidDate ? new Date(paidDate) : null,
        method: method || null,
        notes: notes || null,
      },
    });

    redirect(`/tenancies/${id}/payments`);
  }

  async function updatePaymentLine(formData: FormData) {
    "use server";
    const paymentId = String(formData.get("paymentId") ?? "");
    if (!paymentId) redirect(`/tenancies/${id}/payments`);

    const amountDue = Number(formData.get("amountDue") ?? 0);
    const amountPaid = Number(formData.get("amountPaid") ?? 0);
    const paidDate = String(formData.get("paidDate") ?? "").trim();
    const method = String(formData.get("method") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        amountDue: Math.round(amountDue * 100),
        amountPaid: Math.round((amountPaid || 0) * 100),
        paidDate: paidDate ? new Date(paidDate) : null,
        method: method || null,
        notes: notes || null,
      },
    });

    redirect(`/tenancies/${id}/payments#${paymentId}`);
  }

  async function markFullyPaid(formData: FormData) {
    "use server";
    const paymentId = String(formData.get("paymentId") ?? "");
    if (!paymentId) redirect(`/tenancies/${id}/payments`);
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) redirect(`/tenancies/${id}/payments`);

    await prisma.payment.update({
      where: { id: paymentId },
      data: { amountPaid: payment.amountDue, paidDate: new Date() },
    });

    redirect(`/tenancies/${id}/payments#${paymentId}`);
  }

  async function archivePayment(formData: FormData) {
    "use server";
    const paymentId = String(formData.get("paymentId") ?? "");
    if (!paymentId) redirect(`/tenancies/${id}/payments`);
    await prisma.payment.update({ where: { id: paymentId }, data: { deletedAt: new Date() } });
    redirect(`/tenancies/${id}/payments`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment history</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tenancy.property.name} · {tenantNames}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/tenancies/${id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">Back to tenancy</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Monthly rent</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{money(tenancy.rentMonthly)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Arrears</div>
          <div className={`mt-1 text-2xl font-bold ${arrears > 0 ? "text-red-700" : "text-green-700"}`}>{money(arrears)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Payment lines</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{tenancy.payments.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Auto-rent</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{tenancy.autoGenerateRent ? "On" : "Off"}</div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">Add payment line</h2>
        <form action={addPaymentLine} className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium text-slate-700">Due date<input name="dueDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Amount due (£)<input name="amountDue" type="number" step="0.01" className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Amount paid (£)<input name="amountPaid" type="number" step="0.01" defaultValue="0" className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Paid date<input name="paidDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Method<input name="method" className="rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="Bank transfer" /></label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Notes<input name="notes" className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
          <div className="md:col-span-3"><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">Add payment line</button></div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">All payment lines</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {tenancy.payments.map((payment) => {
            const outstanding = Math.max(0, payment.amountDue - payment.amountPaid);
            const status = getPaymentStatus(payment.amountDue, payment.amountPaid, payment.dueDate, today);
            return (
              <details key={payment.id} id={payment.id} className="group" open={outstanding > 0 && payment.dueDate <= today}>
                <summary className="cursor-pointer list-none px-4 py-3 hover:bg-slate-50">
                  <div className="grid gap-2 md:grid-cols-[1.1fr,1fr,1fr,1.1fr,auto] md:items-center">
                    <div>
                      <div className="font-medium text-slate-900">Due {fmt(payment.dueDate)}</div>
                      <div className="text-sm text-slate-500">Paid {fmt(payment.paidDate) || "—"}</div>
                    </div>
                    <div className="text-sm text-slate-700">Due {money(payment.amountDue)}</div>
                    <div className="text-sm text-slate-700">Paid {money(payment.amountPaid)}</div>
                    <div className={`text-sm font-medium ${outstanding > 0 ? "text-red-700" : "text-green-700"}`}>{status} · {money(outstanding)} outstanding</div>
                    <div className="text-right text-xs text-slate-400 group-open:hidden">Edit</div>
                  </div>
                </summary>
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                  <form action={updatePaymentLine} className="grid gap-4 md:grid-cols-3">
                    <input type="hidden" name="paymentId" value={payment.id} />
                    <label className="grid gap-1 text-sm font-medium text-slate-700">Amount due (£)<input name="amountDue" type="number" step="0.01" defaultValue={(payment.amountDue / 100).toFixed(2)} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">Amount paid (£)<input name="amountPaid" type="number" step="0.01" defaultValue={(payment.amountPaid / 100).toFixed(2)} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">Paid date<input name="paidDate" type="date" defaultValue={fmt(payment.paidDate)} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">Method<input name="method" defaultValue={payment.method ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">Notes<input name="notes" defaultValue={payment.notes ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
                    <div className="md:col-span-3 flex flex-wrap gap-2">
                      <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">Save changes</button>
                    </div>
                  </form>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={markFullyPaid}>
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50" type="submit">Mark fully paid today</button>
                    </form>
                    <form action={archivePayment}>
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <ConfirmSubmit confirmMessage="Archive this payment line?">
                        Archive line
                      </ConfirmSubmit>
                    </form>
                  </div>
                </div>
              </details>
            );
          })}
          {!tenancy.payments.length && <div className="px-4 py-6 text-sm text-slate-500">No payment lines yet.</div>}
        </div>
      </section>
    </div>
  );
}

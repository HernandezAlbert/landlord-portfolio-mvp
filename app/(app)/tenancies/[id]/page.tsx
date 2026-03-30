import { prisma } from "@/lib/prisma";
import { getTenancyArrears } from "@/lib/arrears";
import { sendEmailSafe, formatMoney } from "@/lib/email";
import { getPaymentStatus, ensureRentScheduleForTenancy } from "@/lib/rent";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

function money(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function TenancyDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const qs = (await searchParams) ?? {};
  const sent = typeof qs.sent === "string" ? qs.sent : "";
  const error = typeof qs.error === "string" ? decodeURIComponent(qs.error) : "";
  await ensureRentScheduleForTenancy(id, new Date());

  const tenancyResult = await prisma.tenancy.findFirst({
    where: { id, deletedAt: null },
    include: {
      property: true,
      tenants: { include: { tenant: true } },
    },
  });

  if (!tenancyResult) redirect("/tenancies");
  const tenancy = tenancyResult;

  const [recentPayments, recentNotices, recentContacts, allTenants] = await Promise.all([
    prisma.payment.findMany({ where: { tenancyId: id, deletedAt: null }, orderBy: { dueDate: "desc" }, take: 5 }),
    prisma.notice.findMany({ where: { tenancyId: id, deletedAt: null }, orderBy: { dateServed: "desc" }, take: 3 }),
    prisma.contactLog.findMany({ where: { tenancyId: id, deletedAt: null }, orderBy: { date: "desc" }, take: 5 }),
    prisma.tenant.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);

  const asOf = new Date();
  const arrears = await getTenancyArrears(tenancy.id, asOf);
  const existingTenantIds = new Set(tenancy.tenants.map((tt) => tt.tenantId));
  const availableToAdd = allTenants.filter((t) => !existingTenantIds.has(t.id));

  async function addPayment(formData: FormData) {
    "use server";
    const dueDate = String(formData.get("dueDate") ?? "").trim();
    const amountDuePounds = Number(formData.get("amountDue") ?? 0);
    const amountPaidPounds = Number(formData.get("amountPaid") ?? 0);
    const paidDate = String(formData.get("paidDate") ?? "").trim();
    const method = String(formData.get("method") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!dueDate || !amountDuePounds) redirect(`/tenancies/${id}`);

    await prisma.payment.create({
      data: {
        tenancyId: id,
        dueDate: new Date(dueDate),
        amountDue: Math.round(amountDuePounds * 100),
        amountPaid: Math.round((amountPaidPounds || 0) * 100),
        paidDate: paidDate ? new Date(paidDate) : null,
        method: method || null,
        notes: notes || null,
      },
    });

    redirect(`/tenancies/${id}`);
  }

  async function addNotice(formData: FormData) {
    "use server";
    const type = String(formData.get("type") ?? "OTHER");
    const dateServed = String(formData.get("dateServed") ?? "").trim();
    const method = String(formData.get("method") ?? "OTHER");
    const notes = String(formData.get("notes") ?? "").trim();
    if (!dateServed) redirect(`/tenancies/${id}`);
    await prisma.notice.create({
      data: { tenancyId: id, type: type as any, dateServed: new Date(dateServed), method: method as any, notes: notes || null },
    });
    redirect(`/tenancies/${id}`);
  }

  async function addContact(formData: FormData) {
    "use server";
    const type = String(formData.get("type") ?? "NOTE");
    const date = String(formData.get("date") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const nextFollowUp = String(formData.get("nextFollowUp") ?? "").trim();
    if (!date || !notes) redirect(`/tenancies/${id}`);
    await prisma.contactLog.create({
      data: {
        tenancyId: id,
        type: type as any,
        date: new Date(date),
        subject: subject || null,
        notes,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
      },
    });
    redirect(`/tenancies/${id}`);
  }

  async function addTenantToTenancy(formData: FormData) {
    "use server";
    const tenantId = String(formData.get("tenantId") ?? "");
    if (!tenantId) redirect(`/tenancies/${id}`);
    await prisma.tenancyTenant.create({ data: { tenancyId: id, tenantId, role: "Joint" } }).catch(() => {});
    redirect(`/tenancies/${id}`);
  }

  async function removeTenantFromTenancy(formData: FormData) {
    "use server";
    const tenantId = String(formData.get("tenantId") ?? "");
    if (!tenantId) redirect(`/tenancies/${id}`);
    await prisma.tenancyTenant.delete({ where: { tenancyId_tenantId: { tenancyId: id, tenantId } } }).catch(() => {});
    redirect(`/tenancies/${id}`);
  }

  async function emailArrearsReminder() {
    "use server";
    const emails = tenancy.tenants.map((t) => t.tenant.email).filter(Boolean) as string[];
    if (!emails.length || arrears <= 0) redirect(`/tenancies/${id}`);
    const subject = `Rent arrears reminder — ${tenancy.property.name}`;
    const text = `Rent arrears are currently ${formatMoney(arrears)} for ${tenancy.property.address1}, ${tenancy.property.postcode}. Please arrange payment as soon as possible.`;
    const html = `<p>Rent arrears are currently <strong>${formatMoney(arrears)}</strong> for <strong>${tenancy.property.address1}, ${tenancy.property.postcode}</strong>.</p><p>Please arrange payment as soon as possible.</p>`;
    for (const to of emails) {
      const result = await sendEmailSafe({ to, subject, text, html });
      if (!result.ok) redirect(`/tenancies/${id}?error=${encodeURIComponent(result.error)}`);
    }
    redirect(`/tenancies/${id}?sent=arrears-email`);
  }

  async function generateRentNow() {
    "use server";
    await ensureRentScheduleForTenancy(id, new Date());
    redirect(`/tenancies/${id}`);
  }

  async function saveAutoRent(formData: FormData) {
    "use server";
    const autoGenerateRent = String(formData.get("autoGenerateRent") ?? "true") === "true";
    const monthsAhead = Math.min(Math.max(Number(formData.get("rentGenerateMonthsAhead") ?? 3), 1), 24);
    await prisma.tenancy.update({
      where: { id },
      data: { autoGenerateRent, rentGenerateMonthsAhead: monthsAhead },
    });
    if (autoGenerateRent) await ensureRentScheduleForTenancy(id, new Date());
    redirect(`/tenancies/${id}`);
  }

  async function toggleActive(formData: FormData) {
    "use server";
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const endDate = String(formData.get("endDate") ?? "").trim();
    await prisma.tenancy.update({
      where: { id },
      data: { isActive, endDate: !isActive && endDate ? new Date(endDate) : isActive ? null : tenancy.endDate },
    });
    redirect(`/tenancies/${id}`);
  }

  async function deleteTenancy() {
    "use server";
    await prisma.tenancy.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    redirect("/tenancies");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error ? <div className="banner banner-danger">{error}</div> : null}
      {sent ? <div className="banner banner-success">Arrears reminder email sent.</div> : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Tenancy</h1>
          <div style={{ opacity: 0.75 }}>
            {tenancy.property.name} — Start {tenancy.startDate.toISOString().slice(0, 10)} — Rent {money(tenancy.rentMonthly)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href={`/tenancies/${id}/edit`} className="btn btn-secondary btn-sm">Edit</a>
          <form action={deleteTenancy}><ConfirmSubmit className="btn btn-secondary btn-sm" confirmMessage="Archive this tenancy?">Archive</ConfirmSubmit></form>
          <a href="/tenancies" className="btn btn-secondary btn-sm">Back</a>
        </div>
      </div>

      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Status</h2>
          <div style={{ fontWeight: 800 }}>Arrears: {money(arrears)}</div>
          {arrears > 0 && <form action={emailArrearsReminder}><button type="submit" className="btn btn-primary btn-sm">Email arrears reminder</button></form>}
        </div>
        <form action={toggleActive} style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <label>Active?
            <select name="isActive" defaultValue={String(tenancy.isActive)}>
              <option value="true">Yes</option><option value="false">No</option>
            </select>
          </label>
          <label>End date (if not active)
            <input type="date" name="endDate" defaultValue={fmt(tenancy.endDate)} />
          </label>
          <button type="submit" className="btn btn-primary btn-sm">Save</button>
        </form>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Automatic rent tracking</h2>
          <form action={generateRentNow}><button type="submit" className="btn btn-secondary btn-sm">Run now</button></form>
        </div>
        <p style={{ margin: 0, opacity: 0.75 }}>Automatically creates missing monthly rent due rows ahead of time, so arrears and payment status stay current.</p>
        <form action={saveAutoRent} style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <label>Enabled
            <select name="autoGenerateRent" defaultValue={String(tenancy.autoGenerateRent)}>
              <option value="true">Yes</option><option value="false">No</option>
            </select>
          </label>
          <label>Months ahead
            <input type="number" name="rentGenerateMonthsAhead" min={1} max={24} defaultValue={tenancy.rentGenerateMonthsAhead} />
          </label>
          <div style={{ opacity: 0.75 }}>Last run: {tenancy.lastRentGeneratedOn ? tenancy.lastRentGeneratedOn.toISOString().slice(0, 16).replace("T", " ") : "Never"}</div>
          <button type="submit" className="btn btn-primary btn-sm">Save auto-rent settings</button>
        </form>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Tenants</h2>
        <ul style={{ marginTop: 8 }}>
          {tenancy.tenants.map((tt) => (
            <li key={tt.tenantId} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span>{tt.tenant.fullName}{tt.tenant.email ? ` (${tt.tenant.email})` : ""}</span>
              <form action={removeTenantFromTenancy}><input type="hidden" name="tenantId" value={tt.tenantId} /><ConfirmSubmit confirmMessage="Remove this tenant from the tenancy?">Remove</ConfirmSubmit></form>
            </li>
          ))}
        </ul>
        <form action={addTenantToTenancy} style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <label>Add existing tenant
            <select name="tenantId" defaultValue=""><option value="">Select…</option>{availableToAdd.map((t) => <option key={t.id} value={t.id}>{t.fullName}{t.email ? ` (${t.email})` : ""}</option>)}</select>
          </label>
          <button type="submit">Add</button>
          <a href="/tenants" className="btn btn-secondary btn-sm">Create new tenant</a>
        </form>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Recent payments</h2>
          <div style={{ display: "flex", gap: 10 }}><a href={`/tenancies/${id}/payments`} className="btn btn-secondary btn-sm">View full payment history</a><a href="/api/export/payments" className="btn btn-secondary btn-sm">Export CSV</a></div>
        </div>
        <table cellPadding={10} style={{ borderCollapse: "collapse", width: "100%", marginTop: 8 }}>
          <thead><tr><th align="left">Due date</th><th align="left">Due</th><th align="left">Paid</th><th align="left">Status</th><th align="left">Line arrears</th><th align="left">Action</th></tr></thead>
          <tbody>
            {recentPayments.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
                <td>{fmt(p.dueDate)}</td><td>{money(p.amountDue)}</td><td>{money(p.amountPaid)}</td>
                <td>{getPaymentStatus(p.amountDue, p.amountPaid, p.dueDate, asOf)}</td>
                <td>{money(p.amountDue - p.amountPaid)}</td>
                <td><a href={`/tenancies/${id}/payments#${p.id}`} className="btn btn-secondary btn-sm">Edit</a></td>
              </tr>
            ))}
            {!recentPayments.length && <tr><td colSpan={6} style={{ opacity: 0.7 }}>No payments yet.</td></tr>}
          </tbody>
        </table>
        <details style={{ marginTop: 12 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>+ Add payment</summary>
          <form action={addPayment} style={{ marginTop: 10, display: "grid", gap: 10, maxWidth: 720 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label>Due date<input type="date" name="dueDate" style={{ width: "100%" }} /></label><label>Paid date (optional)<input type="date" name="paidDate" style={{ width: "100%" }} /></label></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label>Amount due (£)<input type="number" name="amountDue" step={0.01} min={0} defaultValue={(tenancy.rentMonthly / 100).toFixed(2)} style={{ width: "100%" }} /></label><label>Amount paid (£)<input type="number" name="amountPaid" step={0.01} min={0} defaultValue={0} style={{ width: "100%" }} /></label></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label>Method<input name="method" placeholder="Bank transfer" style={{ width: "100%" }} /></label><label>Notes<input name="notes" style={{ width: "100%" }} /></label></div>
            <button type="submit">Add payment</button>
          </form>
        </details>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Recent notices</h2>
          <a href={`/tenancies/${id}/notices`} className="btn btn-secondary btn-sm">View full notice history</a>
        </div>
        <table cellPadding={10} style={{ borderCollapse: "collapse", width: "100%", marginTop: 8 }}>
          <thead><tr><th align="left">Type</th><th align="left">Date served</th><th align="left">Method</th><th align="left">Notes</th><th align="left">Action</th></tr></thead>
          <tbody>
            {recentNotices.map((n) => <tr key={n.id} style={{ borderTop: "1px solid #eee" }}><td>{n.type}</td><td>{fmt(n.dateServed)}</td><td>{n.method}</td><td>{n.notes ?? ""}</td><td><a href={`/notices/${n.id}/edit`} className="btn btn-secondary btn-sm">Edit</a></td></tr>)}
            {!recentNotices.length && <tr><td colSpan={5} style={{ opacity: 0.7 }}>No notices logged.</td></tr>}
          </tbody>
        </table>
        <details style={{ marginTop: 12 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>+ Add notice</summary>
          <form action={addNotice} style={{ marginTop: 10, display: "grid", gap: 10, maxWidth: 720 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label>Type<select name="type" defaultValue="OTHER" style={{ width: "100%" }}><option value="SECTION_8">Section 8</option><option value="SECTION_21">Section 21</option><option value="RENT_INCREASE">Rent increase</option><option value="OTHER">Other</option></select></label><label>Date served<input type="date" name="dateServed" style={{ width: "100%" }} /></label></div>
            <label>Method<select name="method" defaultValue="OTHER" style={{ width: "100%" }}><option value="EMAIL">Email</option><option value="POST">Post</option><option value="HAND_DELIVERED">Hand delivered</option><option value="OTHER">Other</option></select></label>
            <label>Notes<input name="notes" style={{ width: "100%" }} /></label>
            <button type="submit">Add notice</button>
          </form>
        </details>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Recent contacts</h2>
          <a href={`/tenancies/${id}/contacts`} className="btn btn-secondary btn-sm">View full contact timeline</a>
        </div>
        <table cellPadding={10} style={{ borderCollapse: "collapse", width: "100%", marginTop: 8 }}>
          <thead><tr><th align="left">Date</th><th align="left">Type</th><th align="left">Subject</th><th align="left">Next follow-up</th><th align="left">Notes</th></tr></thead>
          <tbody>
            {recentContacts.map((c) => <tr key={c.id} style={{ borderTop: "1px solid #eee" }}><td>{fmt(c.date)}</td><td>{c.type}</td><td>{c.subject ?? ""}</td><td>{fmt(c.nextFollowUp)}</td><td>{c.notes}</td></tr>)}
            {!recentContacts.length && <tr><td colSpan={5} style={{ opacity: 0.7 }}>No contact entries yet.</td></tr>}
          </tbody>
        </table>
        <details style={{ marginTop: 12 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>+ Add contact log</summary>
          <form action={addContact} style={{ marginTop: 10, display: "grid", gap: 10, maxWidth: 720 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label>Date<input type="date" name="date" style={{ width: "100%" }} /></label><label>Type<select name="type" defaultValue="NOTE" style={{ width: "100%" }}><option value="CALL">Call</option><option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="VISIT">Visit</option><option value="NOTE">Note</option></select></label></div>
            <label>Subject<input name="subject" style={{ width: "100%" }} /></label>
            <label>Notes<input name="notes" style={{ width: "100%" }} /></label>
            <label>Next follow-up<input type="date" name="nextFollowUp" style={{ width: "100%" }} /></label>
            <button type="submit">Add contact</button>
          </form>
        </details>
      </section>
    </div>
  );
}

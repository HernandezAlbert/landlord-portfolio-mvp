import { prisma } from "@/lib/prisma";
import { getTenancyArrears } from "@/lib/arrears";
import { sendEmailSafe, formatMoney } from "@/lib/email";
import { getPaymentStatus, ensureRentScheduleForTenancy } from "@/lib/rent";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";
import { requireSessionUser } from "@/lib/auth";

function money(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function TenancyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  const qs = (await searchParams) ?? {};
  const sent = typeof qs.sent === "string" ? qs.sent : "";
  const error =
    typeof qs.error === "string" ? decodeURIComponent(qs.error) : "";

  const ownedTenancy = await prisma.tenancy.findFirst({
    where: {
      id,
      deletedAt: null,
      property: {
        userId: user.id,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  if (!ownedTenancy) redirect("/tenancies");

  await ensureRentScheduleForTenancy(id, new Date());

  const tenancyResult = await prisma.tenancy.findFirst({
    where: {
      id,
      deletedAt: null,
      property: {
        userId: user.id,
        deletedAt: null,
      },
    },
    include: {
      property: true,
      tenants: {
        include: {
          tenant: true,
        },
      },
    },
  });

  if (!tenancyResult) redirect("/tenancies");
  const tenancy = tenancyResult;

  const [recentPayments, recentNotices, recentContacts, allTenants] =
    await Promise.all([
      prisma.payment.findMany({
        where: { tenancyId: id, deletedAt: null },
        orderBy: { dueDate: "desc" },
        take: 5,
      }),
      prisma.notice.findMany({
        where: { tenancyId: id, deletedAt: null },
        orderBy: { dateServed: "desc" },
        take: 3,
      }),
      prisma.contactLog.findMany({
        where: { tenancyId: id, deletedAt: null },
        orderBy: { date: "desc" },
        take: 5,
      }),
      prisma.tenant.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const asOf = new Date();
  const arrears = await getTenancyArrears(tenancy.id, asOf);
  const existingTenantIds = new Set(tenancy.tenants.map((tt) => tt.tenantId));
  const availableToAdd = allTenants.filter((t) => !existingTenantIds.has(t.id));

  async function addPayment(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const dueDate = String(formData.get("dueDate") ?? "").trim();
    const amountDuePounds = Number(formData.get("amountDue") ?? 0);
    const amountPaidPounds = Number(formData.get("amountPaid") ?? 0);
    const paidDate = String(formData.get("paidDate") ?? "").trim();
    const method = String(formData.get("method") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!owned || !dueDate || !amountDuePounds) redirect(`/tenancies/${id}`);

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

    const currentUser = await requireSessionUser();
    const type = String(formData.get("type") ?? "OTHER");
    const dateServed = String(formData.get("dateServed") ?? "").trim();
    const method = String(formData.get("method") ?? "OTHER");
    const notes = String(formData.get("notes") ?? "").trim();

    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!owned || !dateServed) redirect(`/tenancies/${id}`);

    await prisma.notice.create({
      data: {
        tenancyId: id,
        type: type as any,
        dateServed: new Date(dateServed),
        method: method as any,
        notes: notes || null,
      },
    });

    redirect(`/tenancies/${id}`);
  }

  async function addContact(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const type = String(formData.get("type") ?? "NOTE");
    const date = String(formData.get("date") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const nextFollowUp = String(formData.get("nextFollowUp") ?? "").trim();

    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!owned || !date || !notes) redirect(`/tenancies/${id}`);

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

    const currentUser = await requireSessionUser();
    const tenantId = String(formData.get("tenantId") ?? "");

    const ownedTenancyCheck = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    const ownedTenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: currentUser.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!ownedTenancyCheck || !ownedTenant) redirect(`/tenancies/${id}`);

    await prisma.tenancyTenant
      .create({
        data: {
          tenancyId: id,
          tenantId,
          role: "Joint",
        },
      })
      .catch(() => {});

    redirect(`/tenancies/${id}`);
  }

  async function removeTenantFromTenancy(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const tenantId = String(formData.get("tenantId") ?? "");

    const ownedTenancyCheck = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    const ownedTenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: currentUser.id,
      },
      select: { id: true },
    });

    if (!ownedTenancyCheck || !ownedTenant) redirect(`/tenancies/${id}`);

    await prisma.tenancyTenant
      .delete({
        where: {
          tenancyId_tenantId: {
            tenancyId: id,
            tenantId,
          },
        },
      })
      .catch(() => {});

    redirect(`/tenancies/${id}`);
  }

  async function emailArrearsReminder() {
    "use server";

    const currentUser = await requireSessionUser();

    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      include: {
        property: true,
        tenants: { include: { tenant: true } },
      },
    });

    if (!owned) redirect("/tenancies");

    const currentArrears = await getTenancyArrears(owned.id, new Date());
    const emails = owned.tenants
      .map((t) => t.tenant.email)
      .filter(Boolean) as string[];

    if (!emails.length || currentArrears <= 0) redirect(`/tenancies/${id}`);

    const subject = `Rent arrears reminder — ${owned.property.name}`;
    const text = `Rent arrears are currently ${formatMoney(
      currentArrears,
    )} for ${owned.property.address1}, ${owned.property.postcode}.\nPlease arrange payment as soon as possible.`;
    const html = `
      <p>Rent arrears are currently <strong>${formatMoney(
        currentArrears,
      )}</strong> for ${owned.property.address1}, ${owned.property.postcode}.</p>
      <p>Please arrange payment as soon as possible.</p>
    `;

    for (const to of emails) {
      const result = await sendEmailSafe({ to, subject, text, html });
      if (!result.ok) {
        redirect(`/tenancies/${id}?error=${encodeURIComponent(result.error)}`);
      }
    }

    redirect(`/tenancies/${id}?sent=arrears-email`);
  }

  async function generateRentNow() {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!owned) redirect("/tenancies");

    await ensureRentScheduleForTenancy(id, new Date());
    redirect(`/tenancies/${id}`);
  }

  async function saveAutoRent(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const autoGenerateRent =
      String(formData.get("autoGenerateRent") ?? "true") === "true";
    const monthsAhead = Math.min(
      Math.max(Number(formData.get("rentGenerateMonthsAhead") ?? 3), 1),
      24,
    );

    await prisma.tenancy.updateMany({
      where: {
        id,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      data: {
        autoGenerateRent,
        rentGenerateMonthsAhead: monthsAhead,
      },
    });

    if (autoGenerateRent) await ensureRentScheduleForTenancy(id, new Date());
    redirect(`/tenancies/${id}`);
  }

  async function toggleActive(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const endDate = String(formData.get("endDate") ?? "").trim();

    await prisma.tenancy.updateMany({
      where: {
        id,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      data: {
        isActive,
        endDate: !isActive && endDate
          ? new Date(endDate)
          : isActive
            ? null
            : tenancy.endDate,
      },
    });

    redirect(`/tenancies/${id}`);
  }

  async function deleteTenancy() {
    "use server";

    const currentUser = await requireSessionUser();

    await prisma.tenancy.updateMany({
      where: {
        id,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    redirect("/tenancies");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      ) : null}

      {sent ? (
        <div
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            padding: 12,
            borderRadius: 8,
          }}
        >
          Arrears reminder email sent.
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Tenancy</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            {tenancy.property.name} — Start {tenancy.startDate.toISOString().slice(0, 10)} — Rent{" "}
            {money(tenancy.rentMonthly)}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/tenancies/${id}/edit`}>Edit</Link>
          <form action={deleteTenancy}>
            <ConfirmSubmit confirmMessage="Archive this tenancy?">
              Archive
            </ConfirmSubmit>
          </form>
          <Link href="/tenancies">Back</Link>
        </div>
      </div>

      <section
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Status</h2>
        <div>Arrears: {money(arrears)}</div>

        {arrears > 0 ? (
          <form action={emailArrearsReminder}>
            <button type="submit">Email arrears reminder</button>
          </form>
        ) : null}

        <form action={toggleActive} style={{ display: "grid", gap: 10 }}>
          <label>
            Active?
            <select name="isActive" defaultValue={tenancy.isActive ? "true" : "false"}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label>
            End date (if not active)
            <input type="date" name="endDate" defaultValue={fmt(tenancy.endDate)} />
          </label>
          <button type="submit">Save</button>
        </form>
      </section>

      <section
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              Automatic rent tracking
            </h2>
            <p style={{ marginTop: 6, opacity: 0.8 }}>
              Automatically creates missing monthly rent due rows ahead of time, so arrears and payment status stay current.
            </p>
          </div>
          <form action={generateRentNow}>
            <button type="submit">Run now</button>
          </form>
        </div>

        <form action={saveAutoRent} style={{ display: "grid", gap: 10 }}>
          <label>
            Enabled
            <select
              name="autoGenerateRent"
              defaultValue={tenancy.autoGenerateRent ? "true" : "false"}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label>
            Months ahead
            <input
              type="number"
              name="rentGenerateMonthsAhead"
              min={1}
              max={24}
              defaultValue={tenancy.rentGenerateMonthsAhead}
            />
          </label>

          <div>
            Last run:{" "}
            {tenancy.lastRentGeneratedOn
              ? tenancy.lastRentGeneratedOn.toISOString().slice(0, 16).replace("T", " ")
              : "Never"}
          </div>

          <button type="submit">Save auto-rent settings</button>
        </form>
      </section>

      <section
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Tenants</h2>

        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {tenancy.tenants.map((tt) => (
            <li key={tt.tenantId}>
              {tt.tenant.fullName}
              {tt.tenant.email ? ` (${tt.tenant.email})` : ""}{" "}
              <form action={removeTenantFromTenancy} style={{ display: "inline" }}>
                <input type="hidden" name="tenantId" value={tt.tenantId} />
                <button type="submit">Remove</button>
              </form>
            </li>
          ))}
        </ul>

        <form action={addTenantToTenancy} style={{ display: "flex", gap: 8 }}>
          <select name="tenantId" defaultValue="">
            <option value="">Select…</option>
            {availableToAdd.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
                {t.email ? ` (${t.email})` : ""}
              </option>
            ))}
          </select>
          <button type="submit">Add</button>
          <Link href="/tenants">Create new tenant</Link>
        </form>
      </section>

      <section
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Recent payments</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/payments?tenancyId=${id}`}>View full payment history</Link>
            <Link href={`/api/export/payments?tenancyId=${id}`}>Export CSV</Link>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Due date</th>
              <th align="left">Due</th>
              <th align="left">Paid</th>
              <th align="left">Status</th>
              <th align="left">Line arrears</th>
            </tr>
          </thead>
          <tbody>
            {recentPayments.map((p) => (
              <tr key={p.id}>
                <td>{fmt(p.dueDate)}</td>
                <td>{money(p.amountDue)}</td>
                <td>{money(p.amountPaid)}</td>
                <td>{getPaymentStatus(p.amountDue, p.amountPaid, p.dueDate, asOf)}</td>
                <td>{money(Math.max(0, p.amountDue - p.amountPaid))}</td>
              </tr>
            ))}
            {!recentPayments.length ? (
              <tr>
                <td colSpan={5}>No payments yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <form action={addPayment} style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Add payment</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              Due date
              <input type="date" name="dueDate" />
            </label>
            <label>
              Paid date (optional)
              <input type="date" name="paidDate" />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              Amount due (£)
              <input type="number" step="0.01" min="0" name="amountDue" />
            </label>
            <label>
              Amount paid (£)
              <input type="number" step="0.01" min="0" name="amountPaid" />
            </label>
          </div>
          <label>
            Method
            <input name="method" />
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} />
          </label>
          <button type="submit">Add payment</button>
        </form>
      </section>

      <section
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Recent notices</h2>
          <Link href={`/notices?tenancyId=${id}`}>View full notice history</Link>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Type</th>
              <th align="left">Date served</th>
              <th align="left">Method</th>
              <th align="left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {recentNotices.map((n) => (
              <tr key={n.id}>
                <td>{n.type}</td>
                <td>{fmt(n.dateServed)}</td>
                <td>{n.method}</td>
                <td>{n.notes ?? ""}</td>
              </tr>
            ))}
            {!recentNotices.length ? (
              <tr>
                <td colSpan={4}>No notices logged.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <form action={addNotice} style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Add notice</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              Type
              <select name="type" defaultValue="OTHER">
                <option value="SECTION_8">Section 8</option>
                <option value="SECTION_21">Section 21</option>
                <option value="RENT_INCREASE">Rent increase</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              Date served
              <input type="date" name="dateServed" />
            </label>
          </div>
          <label>
            Method
            <select name="method" defaultValue="OTHER">
              <option value="EMAIL">Email</option>
              <option value="POST">Post</option>
              <option value="HAND_DELIVERED">Hand delivered</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} />
          </label>
          <button type="submit">Add notice</button>
        </form>
      </section>

      <section
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Recent contacts</h2>
          <Link href={`/contacts?tenancyId=${id}`}>View full contact timeline</Link>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Date</th>
              <th align="left">Type</th>
              <th align="left">Subject</th>
              <th align="left">Next follow-up</th>
              <th align="left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {recentContacts.map((c) => (
              <tr key={c.id}>
                <td>{fmt(c.date)}</td>
                <td>{c.type}</td>
                <td>{c.subject ?? ""}</td>
                <td>{fmt(c.nextFollowUp)}</td>
                <td>{c.notes}</td>
              </tr>
            ))}
            {!recentContacts.length ? (
              <tr>
                <td colSpan={5}>No contact entries yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <form action={addContact} style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Add contact log</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              Date
              <input type="date" name="date" />
            </label>
            <label>
              Type
              <select name="type" defaultValue="NOTE">
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="VISIT">Visit</option>
                <option value="NOTE">Note</option>
              </select>
            </label>
          </div>
          <label>
            Subject
            <input name="subject" />
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} />
          </label>
          <label>
            Next follow-up
            <input type="date" name="nextFollowUp" />
          </label>
          <button type="submit">Add contact</button>
        </form>
      </section>
    </div>
  );
}
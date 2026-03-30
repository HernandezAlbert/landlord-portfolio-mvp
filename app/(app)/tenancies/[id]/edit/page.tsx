import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function EditTenancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenancyResult = await prisma.tenancy.findUnique({
    where: { id },
    include: { property: true, tenants: { include: { tenant: true } } },
  });
  if (!tenancyResult) redirect("/tenancies");
  const tenancy = tenancyResult;

  const properties = await prisma.property.findMany({ orderBy: { createdAt: "asc" } });

  async function updateTenancy(formData: FormData) {
    "use server";

    const propertyId = String(formData.get("propertyId") ?? "");
    const startDateStr = String(formData.get("startDate") ?? "").trim();
    const endDateStr = String(formData.get("endDate") ?? "").trim();
    const rentMonthlyPounds = Number(formData.get("rentMonthly") ?? 0);
    const rentDueDay = Number(formData.get("rentDueDay") ?? 1);
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const autoGenerateRent = String(formData.get("autoGenerateRent") ?? "true") === "true";
    const rentGenerateMonthsAhead = Math.min(24, Math.max(1, Number(formData.get("rentGenerateMonthsAhead") ?? 3) || 3));

    if (!propertyId || !startDateStr || !rentMonthlyPounds) redirect(`/tenancies/${id}/edit`);

    await prisma.tenancy.update({
      where: { id },
      data: {
        propertyId,
        startDate: new Date(startDateStr),
        endDate: !isActive && endDateStr ? new Date(endDateStr) : isActive ? null : tenancy.endDate,
        isActive,
        rentMonthly: Math.round(rentMonthlyPounds * 100),
        rentDueDay: Math.min(28, Math.max(1, rentDueDay || 1)),
        autoGenerateRent,
        rentGenerateMonthsAhead,
      },
    });

    redirect(`/tenancies/${id}`);
  }

  async function deleteTenancy() {
    "use server";
    await prisma.tenancy.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    redirect("/tenancies");
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Edit tenancy</h1>
        <a href={`/tenancies/${id}`}>← Back</a>
      </div>

      <form action={updateTenancy} style={{ display: "grid", gap: 10 }}>
        <label>
          Property
          <select name="propertyId" defaultValue={tenancy.propertyId} style={{ width: "100%" }}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.postcode}</option>
            ))}
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Start date
            <input type="date" name="startDate" defaultValue={fmt(tenancy.startDate)} style={{ width: "100%" }} />
          </label>
          <label>
            Rent due day (1–28)
            <input type="number" name="rentDueDay" defaultValue={tenancy.rentDueDay} min={1} max={28} style={{ width: "100%" }} />
          </label>
        </div>

        <label>
          Rent monthly (£)
          <input type="number" name="rentMonthly" defaultValue={(tenancy.rentMonthly / 100).toFixed(2)} step={0.01} min={0} style={{ width: "100%" }} />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Automatic rent tracking
            <select name="autoGenerateRent" defaultValue={String(tenancy.autoGenerateRent)} style={{ width: "100%" }}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <label>
            Generate months ahead
            <input type="number" name="rentGenerateMonthsAhead" defaultValue={tenancy.rentGenerateMonthsAhead} min={1} max={24} style={{ width: "100%" }} />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Active?
            <select name="isActive" defaultValue={String(tenancy.isActive)} style={{ width: "100%" }}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label>
            End date (if not active)
            <input type="date" name="endDate" defaultValue={fmt(tenancy.endDate)} style={{ width: "100%" }} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit">Save</button>
          <a href={`/tenancies/${id}`}>Cancel</a>
        </div>
      </form>

      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Tenants on this tenancy</h2>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          For MVP, manage tenant links on the <a href={`/tenancies/${id}`}>tenancy page</a>.
        </p>
        <ul style={{ marginTop: 8 }}>
          {tenancy.tenants.map((tt) => (
            <li key={tt.tenantId}>{tt.tenant.fullName}{tt.tenant.email ? ` (${tt.tenant.email})` : ""}</li>
          ))}
          {tenancy.tenants.length === 0 && <li style={{ opacity: 0.7 }}>No tenants linked.</li>}
        </ul>
      </section>

      <section style={{ border: "1px solid #f2c2c2", borderRadius: 8, padding: 12, background: "#fff7f7" }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Danger zone</h2>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Deleting a tenancy will delete its payments, notices and tenant links.
        </p>
        <form action={deleteTenancy}>
          <ConfirmSubmit confirmMessage="Delete this tenancy and all its payments/notices? This cannot be undone.">
            Delete tenancy
          </ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}

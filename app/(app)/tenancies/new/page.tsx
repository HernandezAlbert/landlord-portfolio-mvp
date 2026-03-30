import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function asDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function NewTenancyPage({ searchParams }: { searchParams?: { propertyId?: string } }) {
  const properties = await prisma.property.findMany({ orderBy: { createdAt: "asc" } });
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });

  const defaultStart = asDateInput(new Date());
  const preselectedPropertyId = searchParams?.propertyId ?? "";

  async function createTenancy(formData: FormData) {
    "use server";

    const propertyId = String(formData.get("propertyId") ?? "");
    const startDateStr = String(formData.get("startDate") ?? "");
    const rentMonthlyPounds = Number(formData.get("rentMonthly") ?? 0);
    const rentDueDay = Number(formData.get("rentDueDay") ?? 1);
    const tenantIds = formData.getAll("tenantIds").map(String).filter(Boolean);

    if (!propertyId || !startDateStr || !rentMonthlyPounds) redirect("/tenancies/new");

    const autoGenerateRent = String(formData.get("autoGenerateRent") ?? "true") === "true";
    const rentGenerateMonthsAhead = Math.min(24, Math.max(1, Number(formData.get("rentGenerateMonthsAhead") ?? 3) || 3));

    const tenancy = await prisma.tenancy.create({
      data: {
        propertyId,
        startDate: new Date(startDateStr),
        rentMonthly: Math.round(rentMonthlyPounds * 100),
        rentDueDay: Math.min(28, Math.max(1, rentDueDay || 1)),
        isActive: true,
        autoGenerateRent,
        rentGenerateMonthsAhead,
        tenants: {
          create: tenantIds.map((tenantId, idx) => ({ tenantId, role: idx === 0 ? "Lead" : "Joint" })),
        },
      },
    });

    redirect(`/tenancies/${tenancy.id}`);
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>New tenancy</h1>
      <p style={{ margin: 0, opacity: 0.75 }}>
        Create the tenancy first. Then add rent payments from the tenancy page.
      </p>

      <form action={createTenancy} style={{ display: "grid", gap: 10 }}>
        <label>
          Property
          <select name="propertyId" defaultValue={preselectedPropertyId} style={{ width: "100%" }}>
            <option value="">Select…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.postcode}</option>
            ))}
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Start date
            <input type="date" name="startDate" defaultValue={defaultStart} style={{ width: "100%" }} />
          </label>
          <label>
            Rent due day (1–28)
            <input type="number" name="rentDueDay" defaultValue={1} min={1} max={28} style={{ width: "100%" }} />
          </label>
        </div>

        <label>
          Rent monthly (£)
          <input type="number" name="rentMonthly" defaultValue={1200} step={0.01} min={0} style={{ width: "100%" }} />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Automatic rent tracking
            <select name="autoGenerateRent" defaultValue="true" style={{ width: "100%" }}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <label>
            Generate months ahead
            <input type="number" name="rentGenerateMonthsAhead" defaultValue={3} min={1} max={24} style={{ width: "100%" }} />
          </label>
        </div>

        <fieldset style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
          <legend style={{ padding: "0 6px" }}>Tenants on this tenancy</legend>
          <div style={{ display: "grid", gap: 6 }}>
            {tenants.length === 0 && (
              <div style={{ opacity: 0.75 }}>
                No tenants yet. Create tenants first on the <a href="/tenants">Tenants</a> page.
              </div>
            )}
            {tenants.map((t) => (
              <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="tenantIds" value={t.id} />
                <span>{t.fullName}{t.email ? ` (${t.email})` : ""}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit">Create tenancy</button>
          <a href="/tenancies">Cancel</a>
        </div>
      </form>
    </div>
  );
}

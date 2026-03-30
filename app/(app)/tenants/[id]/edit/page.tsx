import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

export default async function EditTenantPage({ params }: { params: { id: string } }) {
  const tenant = await prisma.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) redirect("/tenants");

  async function updateTenant(formData: FormData) {
    "use server";
    const fullName = String(formData.get("fullName") ?? "").trim();
    const emailRaw = String(formData.get("email") ?? "").trim();
    const phoneRaw = String(formData.get("phone") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();

    if (!fullName) redirect(`/tenants/${params.id}/edit`);

    await prisma.tenant.update({
      where: { id: params.id, deletedAt: null },
      data: {
        fullName,
        email: emailRaw || null,
        phone: phoneRaw || null,
        notes: notesRaw || null,
      },
    });

    redirect("/tenants");
  }

  async function deleteTenant() {
    "use server";
    await prisma.tenant.update({ where: { id: params.id, deletedAt: null }, data: { deletedAt: new Date() } });
    redirect("/tenants");
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Edit tenant</h1>
        <a href="/tenants">← Back</a>
      </div>

      <form action={updateTenant} style={{ display: "grid", gap: 10 }}>
        <label>
          Full name
          <input name="fullName" defaultValue={tenant.fullName} style={{ width: "100%" }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Email
            <input name="email" defaultValue={tenant.email ?? ""} style={{ width: "100%" }} />
          </label>
          <label>
            Phone
            <input name="phone" defaultValue={tenant.phone ?? ""} style={{ width: "100%" }} />
          </label>
        </div>
        <label>
          Notes
          <input name="notes" defaultValue={tenant.notes ?? ""} style={{ width: "100%" }} />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit">Save</button>
          <a href="/tenants">Cancel</a>
        </div>
      </form>

      <section style={{ border: "1px solid #f2c2c2", borderRadius: 8, padding: 12, background: "#fff7f7" }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Danger zone</h2>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Deleting a tenant removes them from any linked tenancies.
        </p>
        <form action={deleteTenant}>
          <ConfirmSubmit confirmMessage="Delete this tenant?">Delete tenant</ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}

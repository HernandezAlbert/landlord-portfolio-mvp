import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SubmitButton from "@/components/SubmitButton";
import ConfirmSubmit from "@/components/ConfirmSubmit";

function isCurrentTenant(t: { tenancies: { tenancy: { isActive: boolean; deletedAt: Date | null } }[] }) {
  return t.tenancies.some((tt) => tt.tenancy.deletedAt === null && tt.tenancy.isActive);
}

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    include: { tenancies: { include: { tenancy: { select: { isActive: true, deletedAt: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const current = tenants.filter(isCurrentTenant);
  const archived = tenants.filter((t) => !isCurrentTenant(t));

  async function deleteTenant(formData: FormData) {
    "use server";
    const tenantId = String(formData.get("tenantId") ?? "");
    if (!tenantId) redirect("/tenants");
    await prisma.tenant.update({ where: { id: tenantId }, data: { deletedAt: new Date() } });
    redirect("/tenants");
  }

  async function createTenant(formData: FormData) {
    "use server";
    const fullName = String(formData.get("fullName") ?? "").trim();
    const emailRaw = String(formData.get("email") ?? "").trim();
    const phoneRaw = String(formData.get("phone") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    if (!fullName) redirect("/tenants");
    await prisma.tenant.create({ data: { fullName, email: emailRaw || null, phone: phoneRaw || null, notes: notesRaw || null } });
    redirect("/tenants");
  }

  function TenantTable({ rows, title }: { rows: typeof tenants; title: string }) {
    return (
      <section className="section-shell">
        <h2 className="section-title">{title}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.fullName}</td>
                  <td className="px-4 py-3 text-slate-700">{t.email ?? ""}</td>
                  <td className="px-4 py-3 text-slate-700">{t.phone ?? ""}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isCurrentTenant(t) ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                      {isCurrentTenant(t) ? "Current" : "Archived"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/tenants/${t.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                      <form action={deleteTenant}>
                        <input type="hidden" name="tenantId" value={t.id} />
                        <ConfirmSubmit className="btn btn-secondary btn-sm" confirmMessage="Archive (soft-delete) this tenant? They will remain linked historically.">
                          Archive
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-slate-500">None.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
        <p className="mt-1 text-sm text-slate-500">Manage current and historic tenant records.</p>
      </div>

      <section className="section-shell section-shell-muted max-w-4xl">
        <h2 className="section-title">Add tenant</h2>
        <form action={createTenant} className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Full name
            <input name="fullName" placeholder="e.g. John Smith" className="rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Email (optional)
              <input name="email" className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Phone (optional)
              <input name="phone" className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Notes
            <input name="notes" className="rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div>
            <SubmitButton>Create tenant</SubmitButton>
          </div>
        </form>
      </section>

      <TenantTable rows={current} title="Current tenants" />
      <TenantTable rows={archived} title="Archived tenants (no active tenancies)" />
    </div>
  );
}

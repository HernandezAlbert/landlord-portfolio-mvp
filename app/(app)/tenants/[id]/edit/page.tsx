import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateInput(value?: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });

  if (!tenant) redirect("/tenants");

  async function updateTenant(formData: FormData) {
    "use server";

    const fullName = String(formData.get("fullName") ?? "").trim();
    const emailRaw = String(formData.get("email") ?? "").trim();
    const phoneRaw = String(formData.get("phone") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const rightToRentExpiresOn = parseOptionalDate(formData.get("rightToRentExpiresOn"));

    if (!fullName) redirect(`/tenants/${id}/edit`);

    await prisma.tenant.update({
      where: { id, deletedAt: null },
      data: {
        fullName,
        email: emailRaw || null,
        phone: phoneRaw || null,
        notes: notesRaw || null,
        rightToRentExpiresOn,
      },
    });

    redirect("/tenants");
  }

  async function deleteTenant() {
    "use server";

    await prisma.tenant.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    redirect("/tenants");
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Edit tenant</h1>
        <a href="/tenants">← Back</a>
      </div>

      <form action={updateTenant} className="grid gap-3 rounded-xl border bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span>Full name</span>
          <input
            name="fullName"
            defaultValue={tenant.fullName}
            className="rounded border px-3 py-2"
            required
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Email</span>
            <input
              name="email"
              type="email"
              defaultValue={tenant.email ?? ""}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Phone</span>
            <input
              name="phone"
              defaultValue={tenant.phone ?? ""}
              className="rounded border px-3 py-2"
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span>Right to Rent expiry</span>
          <input
            name="rightToRentExpiresOn"
            type="date"
            defaultValue={formatDateInput(tenant.rightToRentExpiresOn)}
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Notes</span>
          <textarea
            name="notes"
            rows={4}
            defaultValue={tenant.notes ?? ""}
            className="rounded border px-3 py-2"
          />
        </label>

        <div className="flex gap-3">
          <button type="submit">Save</button>
          <a href="/tenants">Cancel</a>
        </div>
      </form>

      <section className="rounded-xl border border-red-200 bg-red-50 p-4">
        <h2 className="text-lg font-semibold text-red-800">Danger zone</h2>
        <p className="mt-1 text-sm text-red-700">
          Deleting a tenant removes them from any linked tenancies.
        </p>

        <form action={deleteTenant} className="mt-3">
          <ConfirmSubmit confirmMessage="Delete this tenant? This cannot be undone.">
            Delete tenant
          </ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}
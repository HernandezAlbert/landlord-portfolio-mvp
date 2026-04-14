import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SubmitButton from "@/components/SubmitButton";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { requireSessionUser } from "@/lib/auth";

function isCurrentTenant(t: {
  tenancies: { tenancy: { isActive: boolean; deletedAt: Date | null } }[];
}) {
  return t.tenancies.some(
    (tt) => tt.tenancy.deletedAt === null && tt.tenancy.isActive,
  );
}

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

function getRightToRentBadge(expiresOn: Date | null, isCurrent: boolean) {
  if (!expiresOn) {
    return {
      label: "Not set",
      className: "bg-slate-100 text-slate-600",
    };
  }

  if (!isCurrent) {
    return {
      label: formatDateInput(expiresOn),
      className: "bg-slate-100 text-slate-600",
    };
  }

  const today = new Date();
  const start = new Date(today.toISOString().slice(0, 10));
  const end = new Date(expiresOn.toISOString().slice(0, 10));
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000);

  if (diff < 0) {
    return {
      label: `Expired ${formatDateInput(expiresOn)}`,
      className: "bg-red-100 text-red-700",
    };
  }

  if (diff <= 60) {
    return {
      label: `${formatDateInput(expiresOn)} (${diff}d)`,
      className:
        diff <= 30
          ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: formatDateInput(expiresOn),
    className: "bg-green-100 text-green-700",
  };
}

export default async function TenantsPage() {
  const user = await requireSessionUser();

  const tenants = await prisma.tenant.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    include: {
      tenancies: {
        include: {
          tenancy: {
            select: {
              isActive: true,
              deletedAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const current = tenants.filter(isCurrentTenant);
  const archived = tenants.filter((t) => !isCurrentTenant(t));

  async function deleteTenant(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const tenantId = String(formData.get("tenantId") ?? "");
    if (!tenantId) redirect("/tenants");

    await prisma.tenant.updateMany({
      where: {
        id: tenantId,
        userId: currentUser.id,
      },
      data: { deletedAt: new Date() },
    });

    redirect("/tenants");
  }

  async function createTenant(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const fullName = String(formData.get("fullName") ?? "").trim();
    const emailRaw = String(formData.get("email") ?? "").trim();
    const phoneRaw = String(formData.get("phone") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const rightToRentExpiresOn = parseOptionalDate(
      formData.get("rightToRentExpiresOn"),
    );

    if (!fullName) redirect("/tenants");

    await prisma.tenant.create({
      data: {
        userId: currentUser.id,
        fullName,
        email: emailRaw || null,
        phone: phoneRaw || null,
        notes: notesRaw || null,
        rightToRentExpiresOn,
      },
    });

    redirect("/tenants");
  }

  function TenantTable({
    rows,
    title,
  }: {
    rows: typeof tenants;
    title: string;
  }) {
    return (
      <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-4 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Right to Rent</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const currentTenant = isCurrentTenant(t);
              const rtr = getRightToRentBadge(
                t.rightToRentExpiresOn ?? null,
                currentTenant,
              );

              return (
                <tr key={t.id} className="border-t align-top">
                  <td className="px-4 py-3">{t.fullName}</td>
                  <td className="px-4 py-3">{t.email ?? ""}</td>
                  <td className="px-4 py-3">{t.phone ?? ""}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${rtr.className}`}
                    >
                      {rtr.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {currentTenant ? "Current" : "Archived"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/tenants/${t.id}/edit`}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <form action={deleteTenant}>
                        <input type="hidden" name="tenantId" value={t.id} />
                        <ConfirmSubmit confirmMessage="Archive this tenant?">
                          Archive
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-500">
                  None.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage current and historic tenant records.
        </p>
      </div>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add tenant</h2>

        <form action={createTenant} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Full name</span>
            <input
              name="fullName"
              className="rounded-lg border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Email (optional)</span>
            <input name="email" className="rounded-lg border px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Phone (optional)</span>
            <input name="phone" className="rounded-lg border px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Right to Rent expiry (optional)</span>
            <input
              type="date"
              name="rightToRentExpiresOn"
              className="rounded-lg border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-2">
            <span>Notes</span>
            <textarea
              name="notes"
              rows={3}
              className="rounded-lg border px-3 py-2"
            />
          </label>

          <div className="md:col-span-2">
            <SubmitButton>Create tenant</SubmitButton>
          </div>
        </form>
      </section>

      <TenantTable rows={current} title="Current tenants" />
      <TenantTable rows={archived} title="Historic tenants" />
    </div>
  );
}
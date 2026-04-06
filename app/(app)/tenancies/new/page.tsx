import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function NewTenancyPage({
  searchParams,
}: {
  searchParams?: Promise<{ propertyId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const propertyId = resolvedSearchParams?.propertyId ?? "";

  const [properties, tenants] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { fullName: "asc" },
    }),
  ]);

  async function createTenancy(formData: FormData) {
    "use server";

    const propertyId = String(formData.get("propertyId") ?? "").trim();
    const tenantIds = formData
      .getAll("tenantIds")
      .map((v) => String(v).trim())
      .filter(Boolean);

    const startDateRaw = String(formData.get("startDate") ?? "").trim();
    const endDateRaw = String(formData.get("endDate") ?? "").trim();
    const rentMonthlyRaw = String(formData.get("rentMonthly") ?? "").trim();
    const depositRaw = String(formData.get("deposit") ?? "").trim();
    const paymentDayRaw = String(formData.get("paymentDay") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();

    if (!propertyId || !startDateRaw || !rentMonthlyRaw) {
      redirect("/tenancies/new");
    }

    const rentMonthly = Math.round(Number(rentMonthlyRaw) * 100);
    const deposit =
      depositRaw && Number.isFinite(Number(depositRaw))
        ? Math.round(Number(depositRaw) * 100)
        : null;
    const paymentDay =
      paymentDayRaw && Number.isFinite(Number(paymentDayRaw))
        ? Number(paymentDayRaw)
        : 1;

    const tenancy = await prisma.tenancy.create({
      data: {
        propertyId,
        startDate: new Date(startDateRaw),
        endDate: endDateRaw ? new Date(endDateRaw) : null,
        rentMonthly,
        deposit,
        paymentDay,
        isActive: true,
        notes: notesRaw || null,
        tenants: tenantIds.length
          ? {
              create: tenantIds.map((tenantId) => ({
                tenantId,
              })),
            }
          : undefined,
      },
    });

    redirect(`/tenancies/${tenancy.id}`);
  }

  return (
    <div className="grid gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">New tenancy</h1>
        <a href="/tenancies">← Back</a>
      </div>

      <form
        action={createTenancy}
        className="grid gap-4 rounded-xl border bg-white p-4"
      >
        <label className="grid gap-1 text-sm">
          <span>Property</span>
          <select
            name="propertyId"
            defaultValue={propertyId}
            className="rounded border px-3 py-2"
            required
          >
            <option value="">Select property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Tenants</span>
          <select
            name="tenantIds"
            multiple
            className="min-h-40 rounded border px-3 py-2"
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.fullName}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            Hold Ctrl or Cmd to select more than one tenant.
          </span>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Start date</span>
            <input
              type="date"
              name="startDate"
              className="rounded border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>End date (optional)</span>
            <input
              type="date"
              name="endDate"
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Monthly rent (£)</span>
            <input
              type="number"
              name="rentMonthly"
              step="0.01"
              min="0"
              className="rounded border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Deposit (£)</span>
            <input
              type="number"
              name="deposit"
              step="0.01"
              min="0"
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Payment day of month</span>
            <input
              type="number"
              name="paymentDay"
              min="1"
              max="31"
              defaultValue="1"
              className="rounded border px-3 py-2"
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span>Notes</span>
          <textarea
            name="notes"
            rows={4}
            className="rounded border px-3 py-2"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Create tenancy
          </button>
          <a href="/tenancies" className="rounded-lg border px-4 py-2">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
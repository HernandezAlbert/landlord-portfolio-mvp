import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getMonthlyEquivalentPence(rentAmount: number, rentFrequency: "WEEKLY" | "MONTHLY") {
  return rentFrequency === "WEEKLY" ? Math.round((rentAmount * 52) / 12) : rentAmount;
}

export default async function NewTenancyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSessionUser();
  const params = (await searchParams) || {};
  const error =
    typeof params.error === "string" ? decodeURIComponent(params.error) : "";

  const now = new Date();

  const [properties, tenants] = await Promise.all([
    prisma.property.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
      include: {
        tenancies: {
          where: {
            deletedAt: null,
            isActive: true,
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
          select: { id: true },
        },
      },
    }),
    prisma.tenant.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
      },
      orderBy: { fullName: "asc" },
      include: {
        tenancies: {
          where: {
            tenancy: {
              deletedAt: null,
              isActive: true,
              OR: [{ endDate: null }, { endDate: { gte: now } }],
              property: {
                userId: user.id,
                deletedAt: null,
              },
            },
          },
          select: {
            tenancyId: true,
          },
        },
      },
    }),
  ]);

  const availableProperties = properties.filter((p) => p.tenancies.length === 0);
  const unavailableProperties = properties.filter((p) => p.tenancies.length > 0);

  const availableTenants = tenants.filter((t) => t.tenancies.length === 0);
  const unavailableTenants = tenants.filter((t) => t.tenancies.length > 0);

  async function createTenancy(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const propertyId = String(formData.get("propertyId") ?? "").trim();
    const tenantId = String(formData.get("tenantId") ?? "").trim();
    const rentAmount = Math.round(Number(formData.get("rentAmount") ?? 0) * 100);
    const rentFrequencyRaw = String(formData.get("rentFrequency") ?? "MONTHLY").trim();
    const rentFrequency = rentFrequencyRaw === "WEEKLY" ? "WEEKLY" : "MONTHLY";
    const startDateRaw = String(formData.get("startDate") ?? "").trim();

    const [property, tenant] = await Promise.all([
      prisma.property.findFirst({
        where: {
          id: propertyId,
          userId: currentUser.id,
          deletedAt: null,
        },
      }),
      prisma.tenant.findFirst({
        where: {
          id: tenantId,
          userId: currentUser.id,
          deletedAt: null,
        },
      }),
    ]);

    const startDate = startDateRaw ? new Date(`${startDateRaw}T00:00:00.000Z`) : null;

    if (!property || !tenant || rentAmount <= 0 || !startDate || Number.isNaN(startDate.getTime())) {
      redirect("/tenancies/new?error=Please%20complete%20all%20fields%20correctly.");
    }

    const [existingActiveTenancyForProperty, existingActiveTenancyForTenant] =
      await Promise.all([
        prisma.tenancy.findFirst({
          where: {
            propertyId,
            deletedAt: null,
            isActive: true,
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
            property: {
              userId: currentUser.id,
              deletedAt: null,
            },
          },
          select: { id: true },
        }),
        prisma.tenancy.findFirst({
          where: {
            deletedAt: null,
            isActive: true,
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
            property: {
              userId: currentUser.id,
              deletedAt: null,
            },
            tenants: {
              some: {
                tenantId,
              },
            },
          },
          include: {
            property: {
              select: {
                name: true,
              },
            },
          },
        }),
      ]);

    if (existingActiveTenancyForProperty) {
      const message = encodeURIComponent(
        `${property.name} already has an active tenancy. End that tenancy first before creating a new one.`
      );
      redirect(`/tenancies/new?error=${message}`);
    }

    if (existingActiveTenancyForTenant) {
      const propertyName =
        existingActiveTenancyForTenant.property?.name || "another property";
      const message = encodeURIComponent(
        `${tenant.fullName} is already on an active tenancy at ${propertyName}. End that tenancy first before creating a new one.`
      );
      redirect(`/tenancies/new?error=${message}`);
    }

    const tenancy = await (prisma.tenancy as any).create({
      data: {
        propertyId,
        rentAmount,
        rentFrequency,
        rentMonthly: getMonthlyEquivalentPence(rentAmount, rentFrequency),
        rentDueDay: startDate.getUTCDate(),
        isActive: true,
        startDate,
        tenants: {
          create: [{ tenantId }],
        },
      },
    });

    redirect(`/tenancies/${tenancy.id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Tenancy</h1>
        <p className="text-sm text-slate-500">
          Create a tenancy and link a tenant to a property.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form
        action={createTenancy}
        className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="propertyId"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Property
          </label>
          <select
            id="propertyId"
            name="propertyId"
            className="w-full rounded-xl border px-3 py-2"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select property
            </option>
            {availableProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {availableProperties.length === 0 ? (
            <p className="mt-2 text-sm text-amber-700">
              No properties are available. Any property already on an active
              tenancy must be freed up first.
            </p>
          ) : null}
          {unavailableProperties.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Hidden from this list because already on an active tenancy:{" "}
              {unavailableProperties.map((p) => p.name).join(", ")}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="tenantId"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Tenant
          </label>
          <select
            id="tenantId"
            name="tenantId"
            className="w-full rounded-xl border px-3 py-2"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select tenant
            </option>
            {availableTenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
          {availableTenants.length === 0 ? (
            <p className="mt-2 text-sm text-amber-700">
              No tenants are available. Any tenant already on an active tenancy
              must be removed from that tenancy first.
            </p>
          ) : null}
          {unavailableTenants.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Hidden from this list because already on an active tenancy:{" "}
              {unavailableTenants.map((t) => t.fullName).join(", ")}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="rentAmount"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Rent amount (£)
            </label>
            <input
              id="rentAmount"
              name="rentAmount"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-xl border px-3 py-2"
              required
            />
          </div>

          <div>
            <label
              htmlFor="rentFrequency"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Rent frequency
            </label>
            <select
              id="rentFrequency"
              name="rentFrequency"
              className="w-full rounded-xl border px-3 py-2"
              defaultValue="MONTHLY"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="startDate"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={toDateInputValue(now)}
            className="w-full rounded-xl border px-3 py-2"
            required
          />
          <p className="mt-2 text-xs text-slate-500">
            Future rent due dates will be generated from this start date and the selected frequency.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Create
          </button>
          <a
            href="/tenancies"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionUser } from "@/lib/auth";

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function EditTenancyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const error =
    typeof resolvedSearchParams.error === "string"
      ? decodeURIComponent(resolvedSearchParams.error)
      : "";

  const tenancy = await prisma.tenancy.findFirst({
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

  if (!tenancy) redirect("/tenancies");

  async function updateTenancy(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const existingTenancy = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        propertyId: true,
        startDate: true,
        property: {
          select: {
            name: true,
          },
        },
        tenants: {
          select: {
            tenantId: true,
            tenant: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!existingTenancy) redirect("/tenancies");

    const rentMonthly = Math.round(
      Number(formData.get("rentMonthly") ?? 0) * 100
    );
    const rentDueDayRaw = Number(formData.get("rentDueDay") ?? 1);
    const rentDueDay = Math.min(28, Math.max(1, rentDueDayRaw || 1));
    const startDateRaw = String(formData.get("startDate") ?? "");
    const endDateRaw = String(formData.get("endDate") ?? "");
    const isActive = String(formData.get("isActive") ?? "true") === "true";

    if (rentMonthly <= 0) {
      redirect(
        `/tenancies/${id}/edit?error=${encodeURIComponent(
          "Monthly rent must be greater than zero."
        )}`
      );
    }

    const startDate = startDateRaw
      ? new Date(startDateRaw)
      : existingTenancy.startDate;
    const endDate = endDateRaw ? new Date(endDateRaw) : null;

    if (isActive) {
      const now = new Date();
      const tenantIds = existingTenancy.tenants.map((tt) => tt.tenantId);

      const conflictingPropertyTenancy = await prisma.tenancy.findFirst({
        where: {
          id: { not: id },
          propertyId: existingTenancy.propertyId,
          deletedAt: null,
          isActive: true,
          OR: [{ endDate: null }, { endDate: { gte: now } }],
          property: {
            userId: currentUser.id,
            deletedAt: null,
          },
        },
        select: { id: true },
      });

      if (conflictingPropertyTenancy) {
        redirect(
          `/tenancies/${id}/edit?error=${encodeURIComponent(
            `${existingTenancy.property.name} already has another active tenancy. End that tenancy first before saving this one as active.`
          )}`
        );
      }

      if (tenantIds.length > 0) {
        const conflictingTenantTenancy = await prisma.tenancy.findFirst({
          where: {
            id: { not: id },
            deletedAt: null,
            isActive: true,
            OR: [{ endDate: null }, { endDate: { gte: now } }],
            property: {
              userId: currentUser.id,
              deletedAt: null,
            },
            tenants: {
              some: {
                tenantId: { in: tenantIds },
              },
            },
          },
          include: {
            property: {
              select: {
                name: true,
              },
            },
            tenants: {
              include: {
                tenant: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        });

        if (conflictingTenantTenancy) {
          const conflictingNames = conflictingTenantTenancy.tenants
            .filter((tt) => tenantIds.includes(tt.tenantId))
            .map((tt) => tt.tenant.fullName)
            .join(", ");

          const propertyName =
            conflictingTenantTenancy.property?.name || "another property";

          redirect(
            `/tenancies/${id}/edit?error=${encodeURIComponent(
              `${
                conflictingNames || "One or more tenants"
              } are already on another active tenancy at ${propertyName}. End that tenancy first before saving this one as active.`
            )}`
          );
        }
      }
    }

    await prisma.tenancy.updateMany({
      where: {
        id,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      data: {
        rentMonthly,
        rentDueDay,
        startDate,
        endDate,
        isActive,
      },
    });

    redirect(`/tenancies/${id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit tenancy</h1>
        <p className="text-sm text-slate-500">{tenancy.property.name}</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form
        action={updateTenancy}
        className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="rentMonthly"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Rent monthly (£)
          </label>
          <input
            id="rentMonthly"
            name="rentMonthly"
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-xl border px-3 py-2"
            defaultValue={(tenancy.rentMonthly / 100).toFixed(2)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="rentDueDay"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Rent due day (1–28)
          </label>
          <input
            id="rentDueDay"
            name="rentDueDay"
            type="number"
            min="1"
            max="28"
            className="w-full rounded-xl border px-3 py-2"
            defaultValue={tenancy.rentDueDay}
            required
          />
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
            className="w-full rounded-xl border px-3 py-2"
            defaultValue={fmt(tenancy.startDate)}
          />
        </div>

        <div>
          <label
            htmlFor="endDate"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            End date (optional)
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            className="w-full rounded-xl border px-3 py-2"
            defaultValue={fmt(tenancy.endDate)}
          />
        </div>

        <div>
          <label
            htmlFor="isActive"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Active?
          </label>
          <select
            id="isActive"
            name="isActive"
            className="w-full rounded-xl border px-3 py-2"
            defaultValue={tenancy.isActive ? "true" : "false"}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Save
          </button>
          <Link
            href={`/tenancies/${id}`}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
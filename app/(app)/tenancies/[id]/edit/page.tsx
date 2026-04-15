import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionUser } from "@/lib/auth";

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function EditTenancyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;

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
    },
  });

  if (!tenancy) redirect("/tenancies");

  async function updateTenancy(formData: FormData) {
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

    const rentMonthly = Math.round(
      Number(formData.get("rentMonthly") ?? 0) * 100
    );

    const rentDueDay = Number(formData.get("rentDueDay") ?? 1);

    const startDateRaw = String(formData.get("startDate") ?? "");
    const endDateRaw = String(formData.get("endDate") ?? "");

    const existingTenancy = await prisma.tenancy.findFirst({
        where: {
          id,
          deletedAt: null,
          property: {
            userId: currentUser.id,
            deletedAt: null,
          },
        },
        select: { startDate: true },
      });

      if (!existingTenancy) redirect("/tenancies");

    const startDate = startDateRaw
      ? new Date(startDateRaw)
      : existingTenancy.startDate;
      
    const endDate = endDateRaw ? new Date(endDateRaw) : null;

    const isActive =
      String(formData.get("isActive") ?? "true") === "true";

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
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            Edit tenancy
          </h1>
          <div style={{ opacity: 0.75 }}>
            {tenancy.property.name}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={`/tenancies/${id}`}
            className="btn btn-secondary btn-sm"
          >
            Back
          </Link>
        </div>
      </div>

      <form
        action={updateTenancy}
        style={{
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 12,
          display: "grid",
          gap: 12,
          maxWidth: 720,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <label>
            Rent monthly (£)
            <input
              type="number"
              name="rentMonthly"
              step={0.01}
              min={0}
              defaultValue={(tenancy.rentMonthly / 100).toFixed(2)}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            Rent due day (1–28)
            <input
              type="number"
              name="rentDueDay"
              min={1}
              max={28}
              defaultValue={tenancy.rentDueDay}
              style={{ width: "100%" }}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <label>
            Start date
            <input
              type="date"
              name="startDate"
              defaultValue={fmt(tenancy.startDate)}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            End date (optional)
            <input
              type="date"
              name="endDate"
              defaultValue={fmt(tenancy.endDate)}
              style={{ width: "100%" }}
            />
          </label>
        </div>

        <label>
          Active?
          <select
            name="isActive"
            defaultValue={String(tenancy.isActive)}
            style={{ width: "100%" }}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" className="btn btn-primary btn-sm">
            Save
          </button>

          <Link
            href={`/tenancies/${id}`}
            className="btn btn-secondary btn-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
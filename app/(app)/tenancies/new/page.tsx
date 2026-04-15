import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewTenancyPage() {
  const user = await requireSessionUser();

  const properties = await prisma.property.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    orderBy: { name: "asc" },
  });

  const tenants = await prisma.tenant.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    orderBy: { fullName: "asc" },
  });

  async function createTenancy(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const propertyId = String(formData.get("propertyId") ?? "").trim();
    const tenantId = String(formData.get("tenantId") ?? "").trim();
    const rentMonthly = Math.round(
      Number(formData.get("rentMonthly") ?? 0) * 100,
    );
    const rentDueDayRaw = Number(formData.get("rentDueDay") ?? 1);
    const rentDueDay = Math.min(28, Math.max(1, rentDueDayRaw || 1));

    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        userId: currentUser.id,
        deletedAt: null,
      },
    });

    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: currentUser.id,
        deletedAt: null,
      },
    });

    if (!property || !tenant || rentMonthly <= 0) {
      redirect("/tenancies");
    }

    const tenancy = await prisma.tenancy.create({
      data: {
        propertyId,
        rentMonthly,
        rentDueDay,
        isActive: true,
        startDate: new Date(),
        tenants: {
          create: [{ tenantId }],
        },
      },
    });

    redirect(`/tenancies/${tenancy.id}`);
  }

  return (
    <form action={createTenancy} className="space-y-4">
      <h1 className="text-xl font-bold">New Tenancy</h1>

      <label className="grid gap-1">
        <span>Property</span>
        <select name="propertyId" className="border p-2" defaultValue="">
          <option value="" disabled>
            Select property
          </option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1">
        <span>Tenant</span>
        <select name="tenantId" className="border p-2" defaultValue="">
          <option value="" disabled>
            Select tenant
          </option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1">
        <span>Monthly rent (£)</span>
        <input
          name="rentMonthly"
          type="number"
          min="0"
          step="0.01"
          placeholder="Monthly rent"
          className="border p-2"
        />
      </label>

      <label className="grid gap-1">
        <span>Rent due day</span>
        <input
          name="rentDueDay"
          type="number"
          min="1"
          max="28"
          defaultValue={1}
          className="border p-2"
        />
      </label>

      <button className="btn btn-primary">Create</button>
    </form>
  );
}
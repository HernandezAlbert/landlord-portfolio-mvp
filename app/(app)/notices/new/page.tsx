import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function NewNoticePage({
  searchParams,
}: {
  searchParams?: Promise<{ tenancyId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedTenancyId = resolvedSearchParams?.tenancyId ?? "";

  const tenancies = await prisma.tenancy.findMany({
    where: {
      deletedAt: null,
      property: { deletedAt: null },
    },
    include: {
      property: {
        select: { name: true },
      },
    },
    orderBy: { startDate: "desc" },
  });

  async function createNotice(formData: FormData) {
    "use server";

    const tenancyId = String(formData.get("tenancyId") ?? "").trim();
    const type = String(formData.get("type") ?? "OTHER");
    const dateServed = String(formData.get("dateServed") ?? "").trim();
    const method = String(formData.get("method") ?? "OTHER");
    const notes = String(formData.get("notes") ?? "").trim();

    if (!tenancyId || !dateServed) {
      redirect("/notices/new");
    }

    await prisma.notice.create({
      data: {
        tenancyId,
        type: type as any,
        dateServed: new Date(dateServed),
        method: method as any,
        notes: notes || null,
      },
    });

    redirect(`/tenancies/${tenancyId}/notices`);
  }

  return (
    <div className="grid gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">New notice</h1>
        <a href="/notices">← Back</a>
      </div>

      <form
        action={createNotice}
        className="grid gap-4 rounded-xl border bg-white p-4"
      >
        <label className="grid gap-1 text-sm">
          <span>Tenancy</span>
          <select
            name="tenancyId"
            defaultValue={selectedTenancyId}
            className="rounded border px-3 py-2"
            required
          >
            <option value="">Select tenancy</option>
            {tenancies.map((tenancy) => (
              <option key={tenancy.id} value={tenancy.id}>
                {tenancy.property.name} — {fmtDate(tenancy.startDate)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Type</span>
            <select
              name="type"
              defaultValue="OTHER"
              className="rounded border px-3 py-2"
            >
              <option value="SECTION_8">Section 8</option>
              <option value="SECTION_21">Section 21</option>
              <option value="RENT_INCREASE">Rent increase</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span>Date served</span>
            <input
              type="date"
              name="dateServed"
              defaultValue={fmtDate(new Date())}
              className="rounded border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-2">
            <span>Method</span>
            <select
              name="method"
              defaultValue="OTHER"
              className="rounded border px-3 py-2"
            >
              <option value="POST">Post</option>
              <option value="EMAIL">Email</option>
              <option value="HAND_DELIVERED">Hand delivered</option>
              <option value="OTHER">Other</option>
            </select>
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
            Create notice
          </button>
          <a href="/notices" className="rounded-lg border px-4 py-2">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
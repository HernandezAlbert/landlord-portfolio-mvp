import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const noticeResult = await prisma.notice.findUnique({
    where: { id, deletedAt: null },
    include: { tenancy: { include: { property: true } } },
  });

  if (!noticeResult) redirect("/notices");

  const notice = noticeResult;

  async function updateNotice(formData: FormData) {
    "use server";

    const type = String(formData.get("type") ?? "OTHER");
    const dateServed = String(formData.get("dateServed") ?? "").trim();
    const method = String(formData.get("method") ?? "OTHER");
    const notes = String(formData.get("notes") ?? "").trim();

    if (!dateServed) redirect(`/notices/${id}/edit`);

    await prisma.notice.update({
      where: { id, deletedAt: null },
      data: {
        type: type as any,
        dateServed: new Date(dateServed),
        method: method as any,
        notes: notes || null,
      },
    });

    redirect(`/tenancies/${notice.tenancyId}`);
  }

  async function deleteNotice() {
    "use server";

    const tenancyId = notice.tenancyId;

    await prisma.notice.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    redirect(`/tenancies/${tenancyId}`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit notice</h1>
        <a href={`/tenancies/${notice.tenancyId}`} className="text-sm underline">
          Back
        </a>
      </div>

      <form
        action={updateNotice}
        className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm"
      >
        <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
          {notice.tenancy.property.name} — tenancy start {fmt(notice.tenancy.startDate)}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Type</span>
            <select
              name="type"
              defaultValue={notice.type}
              className="rounded-xl border px-3 py-2"
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
              defaultValue={fmt(notice.dateServed)}
              className="rounded-xl border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-2">
            <span>Method</span>
            <select
              name="method"
              defaultValue={notice.method}
              className="rounded-xl border px-3 py-2"
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
            defaultValue={notice.notes ?? ""}
            className="min-h-28 rounded-xl border px-3 py-2"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Save
          </button>

          <a
            href={`/tenancies/${notice.tenancyId}`}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </a>
        </div>
      </form>

      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <h2 className="text-lg font-semibold text-red-800">Danger zone</h2>
        <form action={deleteNotice} className="mt-4">
          <ConfirmSubmit
            title="Delete notice?"
            description="This will hide the notice from active lists."
            confirmText="Delete notice"
          >
            <button
              type="submit"
              className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700"
            >
              Delete notice
            </button>
          </ConfirmSubmit>
        </form>
      </div>
    </div>
  );
}
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";
import { requireSessionUser } from "@/lib/auth";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;

  const noticeResult = await prisma.notice.findFirst({
    where: {
      id,
      deletedAt: null,
      tenancy: {
        property: {
          userId: user.id,
          deletedAt: null,
        },
      },
    },
    include: {
      tenancy: {
        include: {
          property: true,
        },
      },
    },
  });

  if (!noticeResult) redirect("/notices");

  const notice = noticeResult;

  async function updateNotice(formData: FormData) {
    "use server";

    const user = await requireSessionUser();

    const owned = await prisma.notice.findFirst({
      where: {
        id,
        deletedAt: null,
        tenancy: {
          property: {
            userId: user.id,
            deletedAt: null,
          },
        },
      },
      select: { id: true },
    });

    if (!owned) redirect("/notices");

    const type = String(formData.get("type") ?? "OTHER");
    const dateServed = String(formData.get("dateServed") ?? "").trim();
    const method = String(formData.get("method") ?? "OTHER");
    const notes = String(formData.get("notes") ?? "").trim();

    if (!dateServed) redirect(`/notices/${id}/edit`);

    await prisma.notice.updateMany({
      where: { id },
      data: {
        type: type as any,
        dateServed: new Date(dateServed),
        method: method as any,
        notes: notes || null,
      },
    });

    revalidatePath("/notices");
    revalidatePath(`/tenancies/${notice.tenancyId}`);
    revalidatePath(`/notices/${id}/edit`);

    redirect("/notices");
  }

  async function deleteNotice() {
    "use server";

    const user = await requireSessionUser();

    const owned = await prisma.notice.findFirst({
      where: {
        id,
        deletedAt: null,
        tenancy: {
          property: {
            userId: user.id,
            deletedAt: null,
          },
        },
      },
      select: { id: true },
    });

    if (!owned) redirect("/notices");

    await prisma.notice.updateMany({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/notices");
    revalidatePath(`/tenancies/${notice.tenancyId}`);
    revalidatePath(`/notices/${id}/edit`);

    redirect("/notices");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Edit notice</h1>
          <p className="text-sm text-slate-500">
            {notice.tenancy.property.name} — tenancy start{" "}
            {fmt(notice.tenancy.startDate)}
          </p>
        </div>
        <a href="/notices" className="rounded-xl border px-4 py-2 text-sm font-medium">
          Back
        </a>
      </div>

      <form
        action={updateNotice}
        className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium">
            <span className="mb-1 block text-slate-700">Type</span>
            <select
              name="type"
              defaultValue={notice.type}
              className="w-full rounded-xl border px-3 py-2"
            >
              <option value="SECTION_8">Section 8</option>
              <option value="SECTION_21">Section 21</option>
              <option value="RENT_INCREASE">Rent increase</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            <span className="mb-1 block text-slate-700">Date served</span>
            <input
              type="date"
              name="dateServed"
              defaultValue={fmt(notice.dateServed)}
              className="w-full rounded-xl border px-3 py-2"
              required
            />
          </label>

          <label className="text-sm font-medium">
            <span className="mb-1 block text-slate-700">Method</span>
            <select
              name="method"
              defaultValue={notice.method}
              className="w-full rounded-xl border px-3 py-2"
            >
              <option value="POST">Post</option>
              <option value="EMAIL">Email</option>
              <option value="HAND_DELIVERED">Hand delivered</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium">
          <span className="mb-1 block text-slate-700">Notes</span>
          <textarea
            name="notes"
            defaultValue={notice.notes ?? ""}
            rows={5}
            className="w-full rounded-xl border px-3 py-2"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Save
          </button>
          <a href="/notices" className="rounded-xl border px-4 py-2 text-sm font-medium">
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
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700"
          >
            Delete notice
          </ConfirmSubmit>
        </form>
      </div>
    </div>
  );
}
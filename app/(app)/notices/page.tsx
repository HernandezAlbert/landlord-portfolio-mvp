import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

export default async function NoticesPage() {
  async function deleteNotice(formData: FormData) {
    "use server";
    const noticeId = String(formData.get("noticeId") ?? "");
    if (!noticeId) return;
    await prisma.notice.update({
      where: { id: noticeId },
      data: { deletedAt: new Date() },
    });
  }

  const notices = await prisma.notice.findMany({
    where: { deletedAt: null },
    include: {
      tenancy: {
        include: {
          property: true,
        },
      },
    },
    orderBy: { dateServed: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track served notices across your portfolio.
          </p>
        </div>

        <Link
          href="/notices/new"
          className="btn btn-primary"
        >
          + Add Notice
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Date served</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {notices.map((n) => (
              <tr key={n.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-900">{n.type}</td>
                <td className="px-4 py-3 text-slate-700">{n.tenancy.property.name}</td>
                <td className="px-4 py-3 text-slate-700">
                  {n.dateServed.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3 text-slate-700">{n.method}</td>
                <td className="px-4 py-3 text-slate-700">{n.notes ?? ""}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/notices/${n.id}/edit`}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Edit
                    </Link>

                    <form action={deleteNotice}>
                      <input type="hidden" name="noticeId" value={n.id} />
                      <ConfirmSubmit confirmMessage="Delete this notice?">
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </div>
                </td>
              </tr>
            ))}

            {notices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-sm text-slate-500">
                  No notices recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
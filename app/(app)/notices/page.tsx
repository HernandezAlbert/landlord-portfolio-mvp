import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ConfirmSubmit from "@/components/ConfirmSubmit";

export default async function NoticesPage() {
  const user = await requireSessionUser();

  async function deleteNotice(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const noticeId = String(formData.get("noticeId") || "");

    if (!noticeId) {
      redirect("/notices");
    }

    const notice = await prisma.notice.findFirst({
      where: {
        id: noticeId,
        deletedAt: null,
        tenancy: {
          property: {
            userId: currentUser.id,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        tenancyId: true,
      },
    });

    if (!notice) {
      redirect("/notices");
    }

    await prisma.notice.updateMany({
      where: {
        id: noticeId,
        tenancy: {
          property: {
            userId: currentUser.id,
          },
        },
      },
      data: {
        deletedAt: new Date(),
      },
    });

    revalidatePath("/notices");
    revalidatePath(`/tenancies/${notice.tenancyId}`);

    redirect("/notices");
  }

  const notices = await prisma.notice.findMany({
    where: {
      deletedAt: null,
      tenancy: {
        property: {
          userId: user.id,
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
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Notices</h1>
          <p className="text-sm text-slate-500">
            Track notices served across your portfolio.
          </p>
        </div>
        <Link
          href="/notices/new"
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Add Notice
        </Link>
      </div>

      {notices.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500 shadow-sm">
          No notices found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Served</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {notices.map((notice) => (
                  <tr key={notice.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      {notice.tenancy?.property?.address1 || "-"}
                    </td>
                    <td className="px-4 py-3">{notice.type}</td>
                    <td className="px-4 py-3">
                      {new Date(notice.dateServed).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{notice.method}</td>
                    <td className="px-4 py-3">{notice.notes || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/notices/${notice.id}/edit`}
                          className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                        >
                          Edit
                        </Link>

                        <form action={deleteNotice}>
                          <input type="hidden" name="noticeId" value={notice.id} />
                          <ConfirmSubmit
                            title="Delete notice?"
                            description="This will hide the notice from active lists."
                            confirmText="Delete notice"
                            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700"
                          >
                            Delete
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
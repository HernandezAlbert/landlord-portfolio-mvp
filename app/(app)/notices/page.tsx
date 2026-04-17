// app/(app)/notices/page.tsx

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import ConfirmSubmit from "@/components/ConfirmSubmit";

export default async function NoticesPage() {
  const user = await requireSessionUser();

  async function deleteNotice(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const noticeId = String(formData.get("noticeId") || "");

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notices</h1>

        <Link href="/notices/new" className="btn btn-primary">
          Add Notice
        </Link>
      </div>

      {notices.length === 0 ? (
        <div className="rounded border p-4">No notices found.</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Property</th>
                <th className="p-3">Type</th>
                <th className="p-3">Served</th>
                <th className="p-3">Method</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {notices.map((notice) => (
                <tr key={notice.id} className="border-b">
                  <td className="p-3">
                    {notice.tenancy?.property?.address1 || "-"}
                  </td>
                  <td className="p-3">{notice.type}</td>
                  <td className="p-3">
                    {new Date(notice.dateServed).toLocaleDateString()}
                  </td>
                  <td className="p-3">{notice.method}</td>
                  <td className="p-3">{notice.notes || "-"}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/notices/${notice.id}/edit`}
                        className="btn btn-secondary"
                      >
                        Edit
                      </Link>

                      <form action={deleteNotice}>
                        <input
                          type="hidden"
                          name="noticeId"
                          value={notice.id}
                        />
                        <ConfirmSubmit>Delete</ConfirmSubmit>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
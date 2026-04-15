import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function TenancyNoticesPage({ params }: { params: Promise<{ id: string }> }) {
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
    include: { property: true },
  });

  if (!tenancy) redirect("/tenancies");

  const notices = await prisma.notice.findMany({
    where: {
      tenancyId: id,
      deletedAt: null,
      tenancy: {
        property: {
          userId: user.id,
          deletedAt: null,
        },
      },
    },
    orderBy: { dateServed: "desc" },
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Notice history</h1>
          <div style={{ opacity: 0.75 }}>{tenancy.property.name}</div>
        </div>
        <a href={`/tenancies/${id}`}>← Back to tenancy</a>
      </div>

      <table cellPadding={10} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th align="left">Type</th>
            <th align="left">Date served</th>
            <th align="left">Method</th>
            <th align="left">Notes</th>
            <th align="left">Edit</th>
          </tr>
        </thead>
        <tbody>
          {notices.map((n) => (
            <tr key={n.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{n.type}</td>
              <td>{fmt(n.dateServed)}</td>
              <td>{n.method}</td>
              <td>{n.notes ?? ""}</td>
              <td>
                <a href={`/notices/${n.id}/edit`}>Edit</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
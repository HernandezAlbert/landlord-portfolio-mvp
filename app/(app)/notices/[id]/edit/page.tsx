import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function EditNoticePage({ params }: { params: { id: string } }) {
  const noticeResult = await prisma.notice.findUnique({
    where: { id: params.id, deletedAt: null },
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

    if (!dateServed) redirect(`/notices/${params.id}/edit`);

    await prisma.notice.update({
      where: { id: params.id, deletedAt: null },
      data: {
        type: type as any,
        dateServed: new Date(dateServed),
        method: method as any,
        notes: notes || null,
      },
    });

    // Send you back to the tenancy detail page for context
    redirect(`/tenancies/${notice.tenancyId}`);
  }

  async function deleteNotice() {
    "use server";
    const tenancyId = notice.tenancyId;
    await prisma.notice.update({ where: { id: params.id, deletedAt: null }, data: { deletedAt: new Date() } });
    redirect(`/tenancies/${tenancyId}`);
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Edit notice</h1>
        <a href={`/tenancies/${notice.tenancyId}`}>← Back</a>
      </div>

      <div style={{ opacity: 0.75 }}>
        {notice.tenancy.property.name} — tenancy start {notice.tenancy.startDate.toISOString().slice(0, 10)}
      </div>

      <form action={updateNotice} style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Type
            <select name="type" defaultValue={notice.type} style={{ width: "100%" }}>
              <option value="SECTION_8">Section 8</option>
              <option value="SECTION_21">Section 21</option>
              <option value="RENT_INCREASE">Rent increase</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label>
            Date served
            <input type="date" name="dateServed" defaultValue={fmt(notice.dateServed)} style={{ width: "100%" }} />
          </label>
        </div>

        <label>
          Method
          <select name="method" defaultValue={notice.method} style={{ width: "100%" }}>
            <option value="POST">Post</option>
            <option value="EMAIL">Email</option>
            <option value="HAND_DELIVERED">Hand delivered</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label>
          Notes
          <input name="notes" defaultValue={notice.notes ?? ""} style={{ width: "100%" }} />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit">Save</button>
          <a href={`/tenancies/${notice.tenancyId}`}>Cancel</a>
        </div>
      </form>

      <section style={{ border: "1px solid #f2c2c2", borderRadius: 8, padding: 12, background: "#fff7f7" }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Danger zone</h2>
        <form action={deleteNotice}>
          <ConfirmSubmit confirmMessage="Delete this notice?">Delete notice</ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}

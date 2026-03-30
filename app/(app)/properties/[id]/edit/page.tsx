import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

export default async function EditPropertyPage({ params }: { params: { id: string } }) {
  const property = await prisma.property.findUnique({ where: { id: params.id } });
  if (!property) redirect("/properties");

  async function updateProperty(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const address1 = String(formData.get("address1") ?? "").trim();
    const address2Raw = String(formData.get("address2") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const postcode = String(formData.get("postcode") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const advertisedRentMonthlyPounds = Number(formData.get("advertisedRentMonthly") ?? 0);

    if (!name || !address1 || !city || !postcode) redirect(`/properties/${params.id}/edit`);

    await prisma.property.update({
      where: { id: params.id, deletedAt: null },
      data: {
        name,
        address1,
        address2: address2Raw || null,
        city,
        postcode,
        notes: notesRaw || null,
        advertisedRentMonthly: advertisedRentMonthlyPounds ? Math.round(advertisedRentMonthlyPounds * 100) : null,
      },
    });

    redirect(`/properties/${params.id}`);
  }

  async function deleteProperty() {
    "use server";
    await prisma.property.update({ where: { id: params.id, deletedAt: null }, data: { deletedAt: new Date() } });
    redirect("/properties");
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Edit property</h1>
        <a href={`/properties/${params.id}`}>← Back</a>
      </div>

      <form action={updateProperty} style={{ display: "grid", gap: 10 }}>
        <label>
          Name
          <input name="name" defaultValue={property.name} style={{ width: "100%" }} />
        </label>
        <label>
          Address line 1
          <input name="address1" defaultValue={property.address1} style={{ width: "100%" }} />
        </label>
        <label>
          Address line 2 (optional)
          <input name="address2" defaultValue={property.address2 ?? ""} style={{ width: "100%" }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            City
            <input name="city" defaultValue={property.city} style={{ width: "100%" }} />
          </label>
          <label>
            Postcode
            <input name="postcode" defaultValue={property.postcode} style={{ width: "100%" }} />
          </label>
        </div>
        <label>
          Target / advertised monthly rent (£)
          <input name="advertisedRentMonthly" type="number" step={0.01} min={0} defaultValue={property.advertisedRentMonthly ? (property.advertisedRentMonthly / 100).toFixed(2) : ""} style={{ width: "100%" }} />
        </label>
        <label>
          Notes (optional)
          <textarea name="notes" rows={4} defaultValue={property.notes ?? ""} style={{ width: "100%" }} />
        </label>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="submit">Save</button>
          <a href={`/properties/${params.id}`}>Cancel</a>
        </div>
      </form>

      <section style={{ border: "1px solid #f2c2c2", borderRadius: 8, padding: 12, background: "#fff7f7" }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Danger zone</h2>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Deleting a property will also delete all linked tenancies, payments, notices, compliance items and inspections.
        </p>
        <form action={deleteProperty}>
          <ConfirmSubmit confirmMessage="Delete this property and ALL linked records? This cannot be undone.">
            Delete property
          </ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}

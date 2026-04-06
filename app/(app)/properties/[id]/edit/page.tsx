import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) redirect("/properties");

  async function updateProperty(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const address1 = String(formData.get("address1") ?? "").trim();
    const address2Raw = String(formData.get("address2") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const postcode = String(formData.get("postcode") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const advertisedRentMonthlyPounds = Number(
      formData.get("advertisedRentMonthly") ?? 0,
    );

    if (!name || !address1 || !city || !postcode) {
      redirect(`/properties/${id}/edit`);
    }

    await prisma.property.update({
      where: { id, deletedAt: null },
      data: {
        name,
        address1,
        address2: address2Raw || null,
        city,
        postcode,
        notes: notesRaw || null,
        advertisedRentMonthly: advertisedRentMonthlyPounds
          ? Math.round(advertisedRentMonthlyPounds * 100)
          : null,
      },
    });

    redirect(`/properties/${id}`);
  }

  async function deleteProperty() {
    "use server";

    await prisma.property.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    redirect("/properties");
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Edit property</h1>
        <a href={`/properties/${id}`}>← Back</a>
      </div>

      <form
        action={updateProperty}
        style={{
          display: "grid",
          gap: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label
            style={{
              display: "grid",
              gap: 6,
              gridColumn: "1 / -1",
            }}
          >
            <span>Name</span>
            <input
              name="name"
              defaultValue={property.name}
              className="rounded-xl border px-3 py-2"
              required
            />
          </label>

          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
            <span>Address line 1</span>
            <input
              name="address1"
              defaultValue={property.address1}
              className="rounded-xl border px-3 py-2"
              required
            />
          </label>

          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
            <span>Address line 2 (optional)</span>
            <input
              name="address2"
              defaultValue={property.address2 ?? ""}
              className="rounded-xl border px-3 py-2"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>City</span>
            <input
              name="city"
              defaultValue={property.city}
              className="rounded-xl border px-3 py-2"
              required
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Postcode</span>
            <input
              name="postcode"
              defaultValue={property.postcode}
              className="rounded-xl border px-3 py-2"
              required
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Target / advertised monthly rent (£)</span>
            <input
              name="advertisedRentMonthly"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                typeof property.advertisedRentMonthly === "number"
                  ? (property.advertisedRentMonthly / 100).toFixed(2)
                  : ""
              }
              className="rounded-xl border px-3 py-2"
            />
          </label>

          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
            <span>Notes (optional)</span>
            <textarea
              name="notes"
              rows={4}
              defaultValue={property.notes ?? ""}
              className="rounded-xl border px-3 py-2"
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="submit">Save</button>
          <a href={`/properties/${id}`}>Cancel</a>
        </div>
      </form>

      <section
        style={{
          border: "1px solid #f2c2c2",
          borderRadius: 8,
          padding: 12,
          background: "#fff7f7",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Danger zone</h2>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Deleting a property will also delete all linked tenancies, payments,
          notices, compliance items and inspections.
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
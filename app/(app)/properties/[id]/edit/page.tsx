import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";

function formatDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

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

    const propertyLicenseExpiresOnRaw = String(
      formData.get("propertyLicenseExpiresOn") ?? ""
    ).trim();

    await prisma.property.update({
      where: { id },
      data: {
        name: String(formData.get("name")),
        address1: String(formData.get("address1")),
        address2: String(formData.get("address2")) || null,
        city: String(formData.get("city")),
        postcode: String(formData.get("postcode")),
        notes: String(formData.get("notes")) || null,
        propertyLicenseExpiresOn: propertyLicenseExpiresOnRaw
          ? new Date(propertyLicenseExpiresOnRaw)
          : null,
      },
    });

    redirect(`/properties/${id}`);
  }

  async function deleteProperty() {
    "use server";
    await prisma.property.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    redirect("/properties");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1>Edit property</h1>

      <form action={updateProperty} style={{ display: "grid", gap: 10 }}>
        <input name="name" defaultValue={property.name} />
        <input name="address1" defaultValue={property.address1} />
        <input name="address2" defaultValue={property.address2 ?? ""} />
        <input name="city" defaultValue={property.city} />
        <input name="postcode" defaultValue={property.postcode} />

        {/* ✅ NEW FIELD */}
        <label>
          Property licence expiry
          <input
            name="propertyLicenseExpiresOn"
            type="date"
            defaultValue={formatDate(property.propertyLicenseExpiresOn)}
          />
        </label>

        <textarea name="notes" defaultValue={property.notes ?? ""} />

        <button type="submit">Save</button>
      </form>

      <form action={deleteProperty}>
        <ConfirmSubmit confirmMessage="Delete property?">
          Delete
        </ConfirmSubmit>
      </form>
    </div>
  );
}
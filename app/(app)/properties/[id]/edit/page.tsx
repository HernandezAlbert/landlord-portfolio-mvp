import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";
import { requireSessionUser } from "@/lib/auth";

function formatDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;

  const property = await prisma.property.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!property) redirect("/properties");

  async function updateProperty(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const name = String(formData.get("name") ?? "").trim();
    const address1 = String(formData.get("address1") ?? "").trim();
    const address2Raw = String(formData.get("address2") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const postcode = String(formData.get("postcode") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const advertisedRentMonthlyPounds = Number(
      formData.get("advertisedRentMonthly") ?? 0,
    );
    const propertyLicenseExpiresOnRaw = String(
      formData.get("propertyLicenseExpiresOn") ?? "",
    ).trim();

    if (!name || !address1 || !city || !postcode) {
      redirect(`/properties/${id}/edit`);
    }

    await prisma.property.updateMany({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
      },
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
        propertyLicenseExpiresOn: propertyLicenseExpiresOnRaw
          ? new Date(propertyLicenseExpiresOnRaw)
          : null,
      },
    });

    redirect(`/properties/${id}`);
  }

  async function deleteProperty() {
    "use server";

    const currentUser = await requireSessionUser();

    await prisma.property.updateMany({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
      },
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

        <label>
          Rent (£)
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
          />
        </label>

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
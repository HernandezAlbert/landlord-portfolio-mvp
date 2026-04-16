import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";
import { requireSessionUser } from "@/lib/auth";

function formatDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

const inputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

const labelClassName =
  "mb-1 block text-sm font-semibold text-slate-800";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit property</h1>
        <p className="mt-1 text-sm text-slate-600">
          Update the property details below.
        </p>
      </div>

      <form
        action={updateProperty}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="name" className={labelClassName}>
              Property name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={property.name}
              className={inputClassName}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="address1" className={labelClassName}>
              Address line 1
            </label>
            <input
              id="address1"
              name="address1"
              defaultValue={property.address1}
              className={inputClassName}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="address2" className={labelClassName}>
              Address line 2
            </label>
            <input
              id="address2"
              name="address2"
              defaultValue={property.address2 ?? ""}
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="city" className={labelClassName}>
              City
            </label>
            <input
              id="city"
              name="city"
              defaultValue={property.city}
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="postcode" className={labelClassName}>
              Postcode
            </label>
            <input
              id="postcode"
              name="postcode"
              defaultValue={property.postcode}
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="advertisedRentMonthly" className={labelClassName}>
              Rent (£)
            </label>
            <input
              id="advertisedRentMonthly"
              name="advertisedRentMonthly"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                typeof property.advertisedRentMonthly === "number"
                  ? (property.advertisedRentMonthly / 100).toFixed(2)
                  : ""
              }
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="propertyLicenseExpiresOn" className={labelClassName}>
              Property licence expiry
            </label>
            <input
              id="propertyLicenseExpiresOn"
              name="propertyLicenseExpiresOn"
              type="date"
              defaultValue={formatDate(property.propertyLicenseExpiresOn)}
              className={inputClassName}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notes" className={labelClassName}>
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={property.notes ?? ""}
              rows={5}
              className={inputClassName}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <form action={deleteProperty}>
            <ConfirmSubmit confirmMessage="Delete property?">
              Delete
            </ConfirmSubmit>
          </form>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
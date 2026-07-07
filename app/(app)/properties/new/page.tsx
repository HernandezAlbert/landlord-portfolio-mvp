import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { poundsToPenceOrNull } from "@/lib/money";

export default function NewPropertyPage() {
  async function createProperty(formData: FormData) {
    "use server";

    const user = await requireSessionUser();

    const name = String(formData.get("name") ?? "").trim();
    const address1 = String(formData.get("address1") ?? "").trim();
    const address2Raw = String(formData.get("address2") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const postcode = String(formData.get("postcode") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const advertisedRentMonthly = poundsToPenceOrNull(
      formData.get("advertisedRentMonthly"),
    );
    const propertyLicenseExpiresOnRaw = String(
      formData.get("propertyLicenseExpiresOn") ?? "",
    ).trim();

    if (!name || !address1 || !city || !postcode) {
      redirect("/properties/new");
    }

    const property = await prisma.property.create({
      data: {
        userId: user.id,
        name,
        address1,
        address2: address2Raw || null,
        city,
        postcode,
        notes: notesRaw || null,
        advertisedRentMonthly,
        propertyLicenseExpiresOn: propertyLicenseExpiresOnRaw
          ? new Date(propertyLicenseExpiresOnRaw)
          : null,
        compliance: {
          create: [{ type: "GAS" }, { type: "EICR" }, { type: "EPC" }],
        },
        inspections: { create: [{ lastDate: null, nextDue: null }] },
      },
    });

    redirect(`/properties/${property.id}`);
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
        New property
      </h1>

      <form action={createProperty} style={{ display: "grid", gap: 10 }}>
        <label>
          Name
          <input name="name" style={{ width: "100%" }} />
        </label>

        <label>
          Address line 1
          <input name="address1" style={{ width: "100%" }} />
        </label>

        <label>
          Address line 2 (optional)
          <input name="address2" style={{ width: "100%" }} />
        </label>

        <label>
          City
          <input name="city" style={{ width: "100%" }} />
        </label>

        <label>
          Postcode
          <input name="postcode" style={{ width: "100%" }} />
        </label>

        <label>
          Rent (£)
          <input name="advertisedRentMonthly" type="number" step="0.01" />
        </label>

        <label>
          Property licence expiry (optional)
          <input name="propertyLicenseExpiresOn" type="date" />
        </label>

        <label>
          Notes
          <textarea name="notes" rows={4} />
        </label>

        <button type="submit">Create</button>
      </form>
    </div>
  );
}

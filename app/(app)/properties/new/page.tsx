import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default function NewPropertyPage() {
  async function createProperty(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const address1 = String(formData.get("address1") ?? "").trim();
    const address2Raw = String(formData.get("address2") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const postcode = String(formData.get("postcode") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const advertisedRentMonthlyPounds = Number(formData.get("advertisedRentMonthly") ?? 0);

    if (!name || !address1 || !city || !postcode) {
      // MVP: keep it simple — redirect back (you'll see empty values)
      redirect("/properties/new");
    }

    const property = await prisma.property.create({
      data: {
        name,
        address1,
        address2: address2Raw || null,
        city,
        postcode,
        notes: notesRaw || null,
        advertisedRentMonthly: advertisedRentMonthlyPounds ? Math.round(advertisedRentMonthlyPounds * 100) : null,
        compliance: {
          // Create placeholders so the action list has something to work with
          create: [
            { type: "GAS" },
            { type: "EICR" },
            { type: "EPC" },
          ],
        },
        inspections: { create: [{ lastDate: null, nextDue: null }] },
      },
    });

    redirect(`/properties/${property.id}`);
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>New property</h1>
      <p style={{ margin: 0, opacity: 0.75 }}>
        This creates the property plus placeholder compliance items (Gas/EICR/EPC) and one inspection record.
      </p>

      <form action={createProperty} style={{ display: "grid", gap: 10 }}>
        <label>
          Name
          <input name="name" placeholder="e.g. Flat A" style={{ width: "100%" }} />
        </label>
        <label>
          Address line 1
          <input name="address1" placeholder="10 Example Street" style={{ width: "100%" }} />
        </label>
        <label>
          Address line 2 (optional)
          <input name="address2" placeholder="" style={{ width: "100%" }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            City
            <input name="city" placeholder="London" style={{ width: "100%" }} />
          </label>
          <label>
            Postcode
            <input name="postcode" placeholder="E1 1AA" style={{ width: "100%" }} />
          </label>
        </div>
        <label>
          Target / advertised monthly rent (£)
          <input name="advertisedRentMonthly" type="number" step={0.01} min={0} placeholder="e.g. 1200" style={{ width: "100%" }} />
        </label>
        <label>
          Notes (optional)
          <textarea name="notes" rows={4} style={{ width: "100%" }} />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit">Create</button>
          <a href="/properties">Cancel</a>
        </div>
      </form>
    </div>
  );
}

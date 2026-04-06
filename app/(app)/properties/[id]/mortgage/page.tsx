import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function fmtDate(v: Date | null | undefined) {
  return v ? v.toISOString().slice(0, 10) : "";
}

function poundsToPence(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export default async function PropertyMortgagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
    include: { mortgage: true },
  });

  if (!property || property.deletedAt) redirect("/properties");

  async function saveMortgage(formData: FormData) {
    "use server";

    const lender = String(formData.get("lender") ?? "").trim() || null;
    const mortgageNumber =
      String(formData.get("mortgageNumber") ?? "").trim() || null;
    const productName = String(formData.get("productName") ?? "").trim() || null;
    const productType = String(formData.get("productType") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;

    const interestRateRaw = String(formData.get("interestRate") ?? "").trim();
    const interestRate = interestRateRaw ? Number(interestRateRaw) : null;
    const monthlyPayment = poundsToPence(formData.get("monthlyPayment"));

    const dateOrNull = (key: string) => {
      const raw = String(formData.get(key) ?? "").trim();
      return raw ? new Date(raw) : null;
    };

    await prisma.mortgageDetail.upsert({
      where: { propertyId: id },
      create: {
        propertyId: id,
        lender,
        mortgageNumber,
        productName,
        productType,
        interestRate: Number.isFinite(interestRate as number)
          ? interestRate
          : null,
        monthlyPayment,
        productStartDate: dateOrNull("productStartDate"),
        productEndDate: dateOrNull("productEndDate"),
        mortgageTermStart: dateOrNull("mortgageTermStart"),
        mortgageTermEnd: dateOrNull("mortgageTermEnd"),
        notes,
      },
      update: {
        lender,
        mortgageNumber,
        productName,
        productType,
        interestRate: Number.isFinite(interestRate as number)
          ? interestRate
          : null,
        monthlyPayment,
        productStartDate: dateOrNull("productStartDate"),
        productEndDate: dateOrNull("productEndDate"),
        mortgageTermStart: dateOrNull("mortgageTermStart"),
        mortgageTermEnd: dateOrNull("mortgageTermEnd"),
        notes,
        deletedAt: null,
      },
    });

    redirect(`/properties/${id}`);
  }

  async function clearMortgage() {
    "use server";

    await prisma.mortgageDetail.deleteMany({ where: { propertyId: id } });
    redirect(`/properties/${id}`);
  }

  const mortgage = property.mortgage;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Mortgage details
          </h1>
          <p className="text-sm text-slate-500">{property.name}</p>
        </div>
        <a href={`/properties/${id}`} className="text-sm underline">
          Back
        </a>
      </div>

      <form action={saveMortgage} className="space-y-4 rounded-xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Lender</span>
            <input
              name="lender"
              defaultValue={mortgage?.lender ?? ""}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Mortgage account / reference</span>
            <input
              name="mortgageNumber"
              defaultValue={mortgage?.mortgageNumber ?? ""}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Product name</span>
            <input
              name="productName"
              defaultValue={mortgage?.productName ?? ""}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Product type</span>
            <input
              name="productType"
              defaultValue={mortgage?.productType ?? ""}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Interest rate %</span>
            <input
              name="interestRate"
              type="number"
              step="0.01"
              defaultValue={
                typeof mortgage?.interestRate === "number"
                  ? mortgage.interestRate
                  : ""
              }
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Monthly payment (£)</span>
            <input
              name="monthlyPayment"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                typeof mortgage?.monthlyPayment === "number"
                  ? (mortgage.monthlyPayment / 100).toFixed(2)
                  : ""
              }
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Product start date</span>
            <input
              name="productStartDate"
              type="date"
              defaultValue={fmtDate(mortgage?.productStartDate)}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Product end date</span>
            <input
              name="productEndDate"
              type="date"
              defaultValue={fmtDate(mortgage?.productEndDate)}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Mortgage term start</span>
            <input
              name="mortgageTermStart"
              type="date"
              defaultValue={fmtDate(mortgage?.mortgageTermStart)}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Mortgage term end</span>
            <input
              name="mortgageTermEnd"
              type="date"
              defaultValue={fmtDate(mortgage?.mortgageTermEnd)}
              className="rounded border px-3 py-2"
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span>Notes</span>
          <textarea
            name="notes"
            rows={4}
            defaultValue={mortgage?.notes ?? ""}
            className="rounded border px-3 py-2"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Save mortgage
          </button>
          <a href={`/properties/${id}`} className="rounded-lg border px-4 py-2">
            Cancel
          </a>
        </div>
      </form>

      {mortgage ? (
        <form action={clearMortgage}>
          <button
            type="submit"
            className="rounded-lg border border-red-300 px-4 py-2 text-red-700"
          >
            Remove mortgage details
          </button>
        </form>
      ) : null}
    </div>
  );
}
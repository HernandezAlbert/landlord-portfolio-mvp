import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { money as formatMoney } from "@/lib/finance";
import { syncApplicantsForProperty } from "@/lib/google-form-sync";
import { extractSpreadsheetId } from "@/lib/google-sheets";

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

function fmtDateTime(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 19).replace("T", " ") : "—";
}

function statusLabel(date: Date | null | undefined) {
  if (!date) return { label: "Not set", tone: "text-slate-500" };
  const diff = date.getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, tone: "text-red-600" };
  if (days <= 30) return { label: `Due in ${days}d`, tone: "text-amber-600" };
  return { label: "Current", tone: "text-emerald-600" };
}

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const qs = (await searchParams) ?? {};
  const googleSaved = typeof qs.googleSaved === "string" ? qs.googleSaved : "";
  const googleSync = typeof qs.googleSync === "string" ? decodeURIComponent(qs.googleSync) : "";
  const googleError = typeof qs.googleError === "string" ? decodeURIComponent(qs.googleError) : "";

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      mortgage: true,
      insurancePolicy: true,
      compliance: { where: { deletedAt: null }, orderBy: { type: "asc" } },
      inspections: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
      tenancies: {
        where: { deletedAt: null },
        include: { tenants: { include: { tenant: true } }, payments: { where: { deletedAt: null } } },
      },
      expenses: {
        where: { deletedAt: null },
        orderBy: { date: "desc" },
      },
      applicants: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!property) redirect("/properties");

  async function saveGoogleImportSettings(formData: FormData) {
    "use server";
    const enabled = String(formData.get("googleFormImportEnabled") ?? "false") === "true";
    const googleSheetId = extractSpreadsheetId(String(formData.get("googleSheetId") ?? "").trim()) || null;
    const googleSheetTabName = String(formData.get("googleSheetTabName") ?? "").trim() || null;
    const screeningPassMultiplier = Math.max(1, Number(formData.get("screeningPassMultiplier") ?? 3) || 3);
    const advertisedRentMonthlyPounds = Number(formData.get("advertisedRentMonthly") ?? 0);
    const screeningGuarantorMinMultiplierRaw = Number(formData.get("screeningGuarantorMinMultiplier") ?? 2.0) || 2.0;
    const screeningGuarantorMinMultiplier = Math.max(1, Math.min(screeningPassMultiplier, screeningGuarantorMinMultiplierRaw));
    const resetLastRow = String(formData.get("resetLastRow") ?? "false") === "true";

    await prisma.property.update({
      where: { id },
      data: {
        googleFormImportEnabled: enabled,
        googleSheetId,
        googleSheetTabName,
        screeningPassMultiplier,
        screeningGuarantorMinMultiplier,
        advertisedRentMonthly: advertisedRentMonthlyPounds ? Math.round(advertisedRentMonthlyPounds * 100) : null,
        googleLastImportedRow: resetLastRow ? null : (property?.googleLastImportedRow ?? null),
        googleSyncError: null,
      },
    });

    revalidatePath(`/properties/${id}`);
    redirect(`/properties/${id}?googleSaved=1`);
  }

  async function runApplicantSyncNow() {
    "use server";
    const result = await syncApplicantsForProperty(id, { sendEmails: true });
    revalidatePath(`/properties/${id}`);
    revalidatePath("/applicants");
    if (result.error) {
      redirect(`/properties/${id}?googleError=${encodeURIComponent(result.error)}`);
    }
    if (result.skippedReason) {
      redirect(`/properties/${id}?googleError=${encodeURIComponent(result.skippedReason)}`);
    }
    redirect(
      `/properties/${id}?googleSync=${encodeURIComponent(
        `Sync complete. Imported ${result.imported} new applicant(s). Updated ${result.updated} existing applicant(s).`,
      )}`,
    );
  }

  const activeTenancies = property.tenancies.filter((t) => t.isActive);
  const activeMonthlyRent = activeTenancies.reduce((sum, t) => sum + t.rentMonthly, 0);
  const monthlyRent = property.advertisedRentMonthly ?? activeMonthlyRent;

  const thisMonthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));
  const dueThisMonth = activeTenancies.reduce(
    (sum, tenancy) =>
      sum +
      tenancy.payments
        .filter((payment) => payment.deletedAt === null && payment.dueDate >= thisMonthStart && payment.dueDate < nextMonthStart)
        .reduce((s, payment) => s + payment.amountDue, 0),
    0,
  );
  const receivedThisMonth = property.tenancies.reduce(
    (sum, tenancy) =>
      sum +
      tenancy.payments
        .filter((payment) => payment.deletedAt === null && payment.paidDate && payment.paidDate >= thisMonthStart && payment.paidDate < nextMonthStart)
        .reduce((s, payment) => s + payment.amountPaid, 0),
    0,
  );
  const arrears = activeTenancies.reduce(
    (sum, tenancy) =>
      sum +
      tenancy.payments
        .filter((payment) => payment.deletedAt === null && payment.dueDate <= new Date())
        .reduce((s, payment) => s + Math.max(0, payment.amountDue - payment.amountPaid), 0),
    0,
  );
  const monthExpenses = property.expenses
    .filter((expense) => expense.date >= thisMonthStart && expense.date < nextMonthStart)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const mortgageMonthly = property.mortgage?.monthlyPayment ?? 0;
  const netThisMonth = receivedThisMonth - monthExpenses - mortgageMonthly;
  const hasActiveTenancy = activeTenancies.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{property.name}</h1>
          <div className="text-sm text-slate-500">
            {property.address1}, {property.city}, {property.postcode}
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/properties/${property.id}/edit`} className="px-3 py-2 border rounded-lg">Edit</Link>
          <Link href="/properties" className="px-3 py-2 border rounded-lg">Back</Link>
        </div>
      </div>

      {googleSaved && <div className="banner banner-success">Google Form import settings saved.</div>}
      {googleSync && <div className="banner banner-success">{googleSync}</div>}
      {googleError && <div className="banner banner-danger">{googleError}</div>}

      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-slate-500">Monthly rent</div>
          <div className="text-xl font-bold">{formatMoney(monthlyRent)}</div>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-slate-500">Tenancies</div>
          <div className="text-xl font-bold">{activeTenancies.length}</div>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-slate-500">Mortgage</div>
          <div className="text-xl font-bold">{property.mortgage?.lender ?? "Not set"}</div>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-slate-500">Product end</div>
          <div className="text-xl font-bold">{fmt(property.mortgage?.productEndDate ?? null)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Due this month</div>
          <div className="text-xl font-bold">{formatMoney(dueThisMonth)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Received this month</div>
          <div className="text-xl font-bold text-emerald-700">{formatMoney(receivedThisMonth)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Arrears</div>
          <div className={`text-xl font-bold ${arrears > 0 ? "text-red-700" : "text-emerald-700"}`}>{formatMoney(arrears)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Expenses this month</div>
          <div className="text-xl font-bold">{formatMoney(monthExpenses)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-500">Est. net this month</div>
          <div className={`text-xl font-bold ${netThisMonth >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatMoney(netThisMonth)}</div>
        </div>
      </div>

      <section className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Google Form auto-import</h2>
            <p className="text-sm text-slate-500 mt-1">
              Vercel-ready applicant import for this property. Only properties without an active tenancy are checked automatically.
            </p>
          </div>
          <form action={runApplicantSyncNow}>
            <button type="submit" className="btn btn-secondary btn-sm">Sync now</button>
          </form>
        </div>

        <form action={saveGoogleImportSettings} className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm lg:col-span-2">
            <span className="font-medium text-slate-800">Enable automatic Google Form import</span>
            <select
              name="googleFormImportEnabled"
              defaultValue={property.googleFormImportEnabled ? "true" : "false"}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
            >
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-800">Google Sheet ID or URL</span>
            <input
              name="googleSheetId"
              defaultValue={property.googleSheetId ?? ""}
              placeholder="Spreadsheet ID or full Google Sheet URL"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
            <span className="text-xs text-slate-500">Share the response sheet with your Google service account email before turning this on.</span>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-800">Sheet tab name</span>
            <input
              name="googleSheetTabName"
              defaultValue={property.googleSheetTabName ?? "Form Responses 1"}
              placeholder="Form Responses 1"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
            <span className="text-xs text-slate-500">Usually <code>Form Responses 1</code>.</span>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-800">Target / advertised monthly rent (£)</span>
            <input
              name="advertisedRentMonthly"
              type="number"
              min="0"
              step="0.01"
              defaultValue={property.advertisedRentMonthly ? (property.advertisedRentMonthly / 100).toFixed(2) : ""}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
            <span className="text-xs text-slate-500">Used for applicant screening before a tenancy exists. If blank, the app falls back to an active tenancy rent when available.</span>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-800">Pass affordability multiplier</span>
            <input
              name="screeningPassMultiplier"
              type="number"
              min="1"
              step="0.1"
              defaultValue={property.screeningPassMultiplier}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
            <span className="text-xs text-slate-500">Applicants at or above this multiple of monthly rent are screened green.</span>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-800">Guarantor review floor</span>
            <input
              name="screeningGuarantorMinMultiplier"
              type="number"
              min="1"
              step="0.1"
              defaultValue={property.screeningGuarantorMinMultiplier}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
            <span className="text-xs text-slate-500">Applicants between this floor and the pass multiplier can be amber if they can provide a guarantor.</span>
          </label>

          <label className="grid gap-1 text-sm lg:col-span-2">
            <span className="font-medium text-slate-800">Reset imported row pointer</span>
            <select
              name="resetLastRow"
              defaultValue="false"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
            >
              <option value="false">No</option>
              <option value="true">Yes — re-check from the top next time</option>
            </select>
          </label>

          <div className="lg:col-span-2 flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary">Save Google import settings</button>
          </div>
        </form>

        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-slate-500">Target / advertised rent</div>
            <div className="font-medium mt-1">{property.advertisedRentMonthly ? formatMoney(property.advertisedRentMonthly) : "Not set"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-slate-500">Auto-import status</div>
            <div className="font-medium mt-1">{property.googleFormImportEnabled ? "Enabled" : "Disabled"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-slate-500">Active tenancy check</div>
            <div className="font-medium mt-1">{hasActiveTenancy ? "Automatic import blocked" : "Eligible"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-slate-500">Last checked</div>
            <div className="font-medium mt-1">{fmtDateTime(property.googleLastCheckedAt)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-slate-500">Last synced</div>
            <div className="font-medium mt-1">{fmtDateTime(property.googleLastImportedAt)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-slate-500">Last imported row</div>
            <div className="font-medium mt-1">{property.googleLastImportedRow ?? "—"}</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
          <div><strong>Sheet:</strong> {property.googleSheetId ?? "Not set"}</div>
          <div><strong>Tab:</strong> {property.googleSheetTabName ?? "Not set"}</div>
          <div><strong>Last synced:</strong> {fmtDateTime(property.googleLastImportedAt)}</div>
          <div><strong>Latest sync error:</strong> {property.googleSyncError ?? "None"}</div>
          <div className="text-xs text-slate-500">
            Vercel cron route: <code>/api/cron/google-form-sync</code>. Set <code>CRON_SECRET</code>, <code>EMAIL_TO</code>, and <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> in your deployment environment.
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Mortgage</h2>
            <Link href={`/properties/${property.id}/mortgage`} className="btn btn-secondary btn-sm">Manage</Link>
          </div>
          <div className="text-sm text-slate-500">Lender</div>
          <div className="font-medium">{property.mortgage?.lender ?? "Not set"}</div>
          <div className={`text-sm ${statusLabel(property.mortgage?.productEndDate).tone}`}>
            {property.mortgage?.productEndDate ? `Product ends ${fmt(property.mortgage.productEndDate)}` : "Product end not set"}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Insurance</h2>
            <Link href={`/properties/${property.id}/insurance`} className="btn btn-secondary btn-sm">Manage</Link>
          </div>
          <div className="text-sm text-slate-500">Provider</div>
          <div className="font-medium">{property.insurancePolicy?.provider ?? "Not set"}</div>
          <div className={`text-sm ${statusLabel(property.insurancePolicy?.renewalDate).tone}`}>
            {property.insurancePolicy?.renewalDate ? `Renewal ${fmt(property.insurancePolicy.renewalDate)}` : "Renewal date not set"}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Compliance</h2>
            <Link href={`/properties/${property.id}/compliance`} className="btn btn-secondary btn-sm">Manage</Link>
          </div>
          <div className="space-y-1 text-sm">
            {["GAS", "EICR", "EPC"].map((type) => {
              const item = property.compliance.find((c) => c.type === type);
              const status = statusLabel(item?.expiresOn);
              return (
                <div key={type} className="flex items-center justify-between gap-3">
                  <span>{type}</span>
                  <span className={status.tone}>{item?.expiresOn ? fmt(item.expiresOn) : "Not set"}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-3 border-t pt-2 mt-2">
              <span>Inspection</span>
              <span className={statusLabel(property.inspections[0]?.nextDue).tone}>
                {property.inspections[0]?.nextDue ? fmt(property.inspections[0].nextDue) : "Not set"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded-xl bg-white p-4">
        <div className="flex justify-between mb-3">
          <h2 className="font-semibold">Current tenants</h2>
          <Link href={`/tenancies/new?propertyId=${property.id}`} className="text-blue-600">+ New Tenancy</Link>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2">Tenant</th>
              <th className="text-left p-2">Rent</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {activeTenancies.map((t) =>
              t.tenants.map((tt) => (
                <tr key={tt.tenant.id} className="border-t">
                  <td className="p-2">{tt.tenant.fullName}</td>
                  <td className="p-2">{formatMoney(t.rentMonthly)}</td>
                  <td className="p-2"><Link href={`/tenancies/${t.id}`} className="text-blue-600">Open tenancy</Link></td>
                </tr>
              )),
            )}
            {!activeTenancies.length && (
              <tr className="border-t"><td className="p-3 text-slate-500" colSpan={3}>No active tenancies.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border rounded-xl bg-white p-4">
        <div className="flex justify-between mb-3">
          <h2 className="font-semibold">Recent applicants</h2>
          <Link href="/applicants" className="text-blue-600">View all</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2">Applicant</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Submitted</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {property.applicants.map((applicant) => (
              <tr key={applicant.id} className="border-t">
                <td className="p-2">{applicant.fullName}</td>
                <td className="p-2">{applicant.status}</td>
                <td className="p-2">{fmt(applicant.importSubmittedAt ?? applicant.createdAt)}</td>
                <td className="p-2"><Link href={`/applicants/${applicant.id}`} className="text-blue-600">Open</Link></td>
              </tr>
            ))}
            {!property.applicants.length && (
              <tr className="border-t"><td className="p-3 text-slate-500" colSpan={4}>No applicants yet for this property.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border rounded-xl bg-white p-4">
        <div className="flex justify-between mb-3">
          <h2 className="font-semibold">Recent expenses</h2>
          <Link href={`/expenses/new?propertyId=${property.id}`} className="text-blue-600">+ Add expense</Link>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Category</th>
              <th className="text-left p-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {property.expenses.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">{fmt(e.date)}</td>
                <td className="p-2">{e.category}</td>
                <td className="p-2">{formatMoney(e.amount)}</td>
              </tr>
            ))}
            {!property.expenses.length && (
              <tr className="border-t"><td className="p-3 text-slate-500" colSpan={3}>No expenses recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
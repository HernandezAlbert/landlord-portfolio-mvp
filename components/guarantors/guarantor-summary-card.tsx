import Link from "next/link";

type Guarantor = {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  annualIncomePence?: number | null;
  assessmentStatus?: string | null;
};

export default function GuarantorSummaryCard({
  applicantId,
  guarantors,
  guarantorRequired,
  guarantorAvailable,
  guarantorOutcome,
}: {
  applicantId: string;
  guarantors: Guarantor[];
  guarantorRequired?: boolean | null;
  guarantorAvailable?: boolean | null;
  guarantorOutcome?: string | null;
}) {
  const latest = guarantors?.[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Required: {guarantorRequired ? "Yes" : "No"}</p>
          <p className="text-sm text-slate-500">
            Available: {guarantorAvailable == null ? "-" : guarantorAvailable ? "Yes" : "No"}
          </p>
          <p className="text-sm text-slate-500">Outcome: {guarantorOutcome ?? "-"}</p>
        </div>

        <Link
          href={`/guarantors/new?applicantId=${applicantId}`}
          className="inline-flex items-center rounded-md bg-black px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
        >
          Add Guarantor
        </Link>
      </div>

      {!latest ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No guarantor linked yet.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">
                {latest.fullName || `${latest.firstName} ${latest.lastName}`}
              </p>
              <p className="text-sm text-slate-500">{latest.email || latest.phone || "No contact details"}</p>
              <p className="text-sm text-slate-500">
                Income:{" "}
                {typeof latest.annualIncomePence === "number"
                  ? `£${(latest.annualIncomePence / 100).toLocaleString()}`
                  : "-"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium">
                {latest.assessmentStatus ?? "PENDING"}
              </span>

              <Link
                href={`/guarantors/${latest.id}`}
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                View
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
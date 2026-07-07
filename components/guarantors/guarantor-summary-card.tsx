import Link from "next/link";
import { formatGBPFromPence } from "@/lib/money";

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

function statusChipClass(status?: string | null) {
  if (status === "PASSED") return "bg-green-100 text-green-700 border-green-200";
  if (status === "CONDITIONAL") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "FAILED") return "bg-red-100 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 text-sm text-slate-600">
          <p>Required: {guarantorRequired ? "Yes" : "No"}</p>
          <p>
            Available:{" "}
            {guarantorAvailable == null ? "-" : guarantorAvailable ? "Yes" : "No"}
          </p>
          <p>Outcome: {guarantorOutcome ?? "-"}</p>
        </div>

        <Link
          href={`/guarantors/new?applicantId=${applicantId}`}
          className="btn btn-primary btn-sm"
        >
          Add Guarantor
        </Link>
      </div>

      {!latest ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No guarantor linked yet.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">
                {latest.fullName || `${latest.firstName} ${latest.lastName}`}
              </p>
              <p className="text-sm text-slate-500">
                {latest.email || latest.phone || "No contact details"}
              </p>
              <p className="text-sm text-slate-500">
                Income:{" "}
                {typeof latest.annualIncomePence === "number"
                  ? formatGBPFromPence(latest.annualIncomePence)
                  : "-"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusChipClass(
                  latest.assessmentStatus,
                )}`}
              >
                {latest.assessmentStatus ?? "PENDING"}
              </span>

              <Link
                href={`/guarantors/${latest.id}`}
                className="link-button"
              >
                View guarantor
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

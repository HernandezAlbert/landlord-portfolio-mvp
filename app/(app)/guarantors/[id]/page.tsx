import { notFound, redirect  } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assessGuarantor } from "@/lib/guarantor-assessment";
import Link from "next/link";

async function deleteGuarantor(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;

  await prisma.guarantor.delete({
    where: { id },
  });

  revalidatePath("/guarantors");
}

async function runAssessment(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;

  const guarantor = await prisma.guarantor.findUnique({
    where: { id },
    include: { applicant: true },
  });

  if (!guarantor) return;

  const rentPence = guarantor.applicant?.targetRentPence ?? 0;

  const result = assessGuarantor({
    rentPence,
    annualIncomePence: guarantor.annualIncomePence,
  });

  await prisma.guarantor.update({
    where: { id },
    data: {
      assessmentStatus: result.status,
      assessmentScore: result.score,
      assessmentSummary: result.summary,
    },
  });

  revalidatePath(`/guarantors/${id}`);
}

export default async function GuarantorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const guarantor = await prisma.guarantor.findUnique({
    where: { id },
    include: {
      applicant: true,
    },
  });

  if (!guarantor) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {guarantor.fullName ||
                `${guarantor.firstName} ${guarantor.lastName}`}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {guarantor.email || guarantor.phone || "No contact details"}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/guarantors/${guarantor.id}/edit`}
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </Link>
            
            <form action={runAssessment}>
              <input type="hidden" name="id" value={guarantor.id} />
              <button
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Run Check
              </button>
            </form>

            <form action={deleteGuarantor}>
              <input type="hidden" name="id" value={guarantor.id} />
              <button
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </form>


            {guarantor.applicantId && (
              <Link
                href={`/applicants/${guarantor.applicantId}`}
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                View Applicant
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">Details</h2>

        <p>
          <span className="text-slate-500">First name:</span>{" "}
          {guarantor.firstName}
        </p>

        <p>
          <span className="text-slate-500">Last name:</span>{" "}
          {guarantor.lastName}
        </p>

        <p>
          <span className="text-slate-500">Email:</span>{" "}
          {guarantor.email || "-"}
        </p>

        <p>
          <span className="text-slate-500">Phone:</span>{" "}
          {guarantor.phone || "-"}
        </p>

        <p>
          <span className="text-slate-500">Annual income:</span>{" "}
          {typeof guarantor.annualIncomePence === "number"
            ? `£${(guarantor.annualIncomePence / 100).toLocaleString()}`
            : "-"}
        </p>
      </div>

      {/* Status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">Assessment</h2>

        <p>
          <span className="text-slate-500">Status:</span>{" "}
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              guarantor.assessmentStatus === "PASSED"
                ? "bg-green-100 text-green-700"
                : guarantor.assessmentStatus === "CONDITIONAL"
                ? "bg-amber-100 text-amber-700"
                : guarantor.assessmentStatus === "FAILED"
                ? "bg-red-100 text-red-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {guarantor.assessmentStatus ?? "PENDING"}
          </span>
        </p>

        <p>
          <span className="text-slate-500">Deed signed:</span>{" "}
          {"-"}
        </p>
      </div>
    </div>
  );
}
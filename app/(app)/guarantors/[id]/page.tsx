import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assessGuarantor } from "@/lib/guarantor-assessment";
import SubmitActionButton from "@/components/ui/submit-action-button";
import ToastBridge from "@/components/ui/toast-bridge";

async function getApplicantRentPence(applicantId?: string | null) {
  if (!applicantId) return 0;

  const applicant = await prisma.applicant.findUnique({
    where: { id: applicantId },
    include: {
      property: true,
    },
  });

  if (!applicant) return 0;

  if (applicant.property?.advertisedRentMonthly && applicant.property.advertisedRentMonthly > 0) {
    return applicant.property.advertisedRentMonthly;
  }

  if (!applicant.propertyId) return 0;

  const activeTenancy = await prisma.tenancy.findFirst({
    where: {
      propertyId: applicant.propertyId,
      isActive: true,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  return activeTenancy?.rentMonthly ?? 0;
}

async function deleteGuarantor(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");

  const guarantor = await prisma.guarantor.findUnique({
    where: { id },
    select: { applicantId: true },
  });

  if (!guarantor) return;

  await prisma.guarantor.delete({
    where: { id },
  });

  if (guarantor.applicantId) {
    const remaining = await prisma.guarantor.count({
      where: {
        applicantId: guarantor.applicantId,
        archivedAt: null,
      },
    });

    if (remaining === 0) {
      await prisma.applicant.update({
        where: { id: guarantor.applicantId },
        data: {
          guarantorAvailable: false,
          guarantorOutcome: null,
        },
      });
    }

    revalidatePath(`/applicants/${guarantor.applicantId}`);
    redirect(`/applicants/${guarantor.applicantId}?toast=guarantor-deleted`);
  }

  revalidatePath("/guarantors");
  redirect("/guarantors");
}

async function runAssessment(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");

  const guarantor = await prisma.guarantor.findUnique({
    where: { id },
    include: { applicant: true },
  });

  if (!guarantor) return;

  const rentPence = await getApplicantRentPence(guarantor.applicantId);

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

  if (guarantor.applicantId) {
    await prisma.applicant.update({
      where: { id: guarantor.applicantId },
      data: {
        guarantorAvailable: true,
        guarantorOutcome: result.status,
      },
    });

    revalidatePath(`/applicants/${guarantor.applicantId}`);
  }

  revalidatePath(`/guarantors/${id}`);
  redirect(`/guarantors/${id}?toast=guarantor-check-complete`);
}

function getToastMessage(code?: string) {
  if (code === "guarantor-check-complete") return "Guarantor check complete.";
  return null;
}

export default async function GuarantorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ toast?: string }>;
}) {
  const { id } = await params;
  const qs = (await searchParams) ?? {};
  const toastMessage = getToastMessage(typeof qs.toast === "string" ? qs.toast : undefined);

  const guarantor = await prisma.guarantor.findUnique({
    where: { id },
    include: {
      applicant: true,
    },
  });

  if (!guarantor) notFound();

  return (
    <div className="space-y-6">
      <ToastBridge message={toastMessage} variant="success" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {guarantor.fullName || `${guarantor.firstName} ${guarantor.lastName}`}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {guarantor.email || guarantor.phone || "No contact details"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/guarantors/${guarantor.id}/edit`}
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </Link>

            <form action={runAssessment}>
              <input type="hidden" name="id" value={guarantor.id} />
              <SubmitActionButton
                idleLabel="Run Check"
                pendingLabel="Running..."
                variant="primary"
              />
            </form>

            <form action={deleteGuarantor}>
              <input type="hidden" name="id" value={guarantor.id} />
              <SubmitActionButton
                idleLabel="Delete"
                pendingLabel="Deleting..."
                variant="danger"
              />
            </form>

            {guarantor.applicantId ? (
              <Link
                href={`/applicants/${guarantor.applicantId}`}
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                View Applicant
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">Details</h2>

        <p><span className="text-slate-500">First name:</span> {guarantor.firstName}</p>
        <p><span className="text-slate-500">Last name:</span> {guarantor.lastName}</p>
        <p><span className="text-slate-500">Email:</span> {guarantor.email || "-"}</p>
        <p><span className="text-slate-500">Phone:</span> {guarantor.phone || "-"}</p>
        <p>
          <span className="text-slate-500">Annual income:</span>{" "}
          {typeof guarantor.annualIncomePence === "number"
            ? `£${(guarantor.annualIncomePence / 100).toLocaleString()}`
            : "-"}
        </p>
      </div>

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

        <p><span className="text-slate-500">Score:</span> {guarantor.assessmentScore ?? "-"}</p>
        <p><span className="text-slate-500">Summary:</span> {guarantor.assessmentSummary ?? "-"}</p>
        <p><span className="text-slate-500">Deed signed:</span> {guarantor.deedSigned ? "Yes" : "No"}</p>
      </div>
    </div>
  );
}
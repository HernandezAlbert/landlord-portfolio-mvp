import { prisma } from "@/lib/prisma";
import { HoldingDepositStatus, Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

async function getRent(
  propertyId: string | null | undefined,
  advertisedRentMonthly: number | null
) {
  if (advertisedRentMonthly) return advertisedRentMonthly;
  if (!propertyId) return 0;

  const tenancy = await prisma.tenancy.findFirst({
    where: {
      propertyId,
      isActive: true,
      deletedAt: null,
    },
    orderBy: { startDate: "desc" },
  });

  return tenancy?.rentMonthly ?? 0;
}

function calculateWeeklyRentFromMonthlyPence(monthly: number) {
  return Math.round((monthly * 12) / 52);
}

export default async function ApplicantHoldingDepositPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  await searchParams;

  const applicant = await prisma.applicant.findUnique({
    where: { id },
    include: {
      property: true,
      holdingDeposit: true,
    },
  });

  if (!applicant) notFound();

  const rentMonthly = await getRent(
    applicant.propertyId,
    applicant.property?.advertisedRentMonthly ?? null
  );

  const weeklyRentPence = calculateWeeklyRentFromMonthlyPence(rentMonthly);
  const holdingDeposit = applicant.holdingDeposit;

 async function createHoldingDeposit(formData: FormData) {
  "use server";

  const applicantId = String(formData.get("applicantId") ?? "").trim();
  const amountPounds = Number(formData.get("amountRequested") ?? 0);
  const receivedDateRaw = String(formData.get("receivedAt") ?? "").trim();
  const deadlineRaw = String(formData.get("deadlineAt") ?? "").trim();

  if (!applicantId || !amountPounds) {
    redirect(`/applicants/${id}/holding-deposit`);
  }

  const freshApplicant = await prisma.applicant.findUnique({
    where: { id: applicantId },
    include: { property: true },
  });

  if (!freshApplicant) {
    redirect("/applicants");
  }

  if (!freshApplicant.propertyId) {
    throw new Error("Applicant must have a propertyId");
  }

  const amountPence = Math.round(amountPounds * 100);
  const weeklyRentSnapshotPence = calculateWeeklyRentFromMonthlyPence(
    await getRent(
      freshApplicant.propertyId,
      freshApplicant.property?.advertisedRentMonthly ?? null
    )
  );

  const receivedAt = receivedDateRaw ? new Date(receivedDateRaw) : new Date();
  const deadlineAt = deadlineRaw ? new Date(deadlineRaw) : null;

  const existing = await prisma.holdingDeposit.findUnique({
    where: { applicantId },
    select: { id: true },
  });

  const updateData: Prisma.HoldingDepositUncheckedUpdateInput = {
    amountRequestedPence: amountPence,
    amountReceivedPence: amountPence,
    weeklyRentSnapshotPence,
    receivedAt,
    status: HoldingDepositStatus.RECEIVED,
    ...(deadlineAt ? { deadlineAt } : {}),
  };

  const createData: Prisma.HoldingDepositUncheckedCreateInput = {
    applicantId,
    propertyId: freshApplicant.propertyId,
    amountRequestedPence: amountPence,
    amountReceivedPence: amountPence,
    weeklyRentSnapshotPence,
    receivedAt,
    status: HoldingDepositStatus.RECEIVED,
    ...(deadlineAt ? { deadlineAt } : {}),
  };

  if (existing) {
    await prisma.holdingDeposit.update({
      where: { applicantId },
      data: updateData,
    });
  } else {
    await prisma.holdingDeposit.create({
      data: createData,
    });
  }

  redirect(`/applicants/${id}/holding-deposit`);
}

  return (
    <div className="grid max-w-3xl gap-4">
      <h1 className="text-2xl font-bold">Holding Deposit</h1>

      <div className="rounded border bg-white p-4">
        <p>
          <strong>Applicant:</strong>{" "}
          {[applicant.firstName, applicant.lastName].filter(Boolean).join(" ")}
        </p>
        <p>
          <strong>Property:</strong> {applicant.property?.name ?? "—"}
        </p>
        <p>
          <strong>Monthly Rent:</strong> £{(rentMonthly / 100).toFixed(2)}
        </p>
        <p>
          <strong>Weekly Rent:</strong> £{(weeklyRentPence / 100).toFixed(2)}
        </p>
      </div>

      <form
        action={createHoldingDeposit}
        className="grid gap-3 rounded border bg-white p-4"
      >
        <input type="hidden" name="applicantId" value={id} />

        <label className="grid gap-1">
          <span>Amount (£)</span>
          <input
            name="amountRequested"
            type="number"
            step="0.01"
            required
            className="rounded border px-3 py-2"
            defaultValue={
              typeof holdingDeposit?.amountRequestedPence === "number"
                ? (holdingDeposit.amountRequestedPence / 100).toFixed(2)
                : ""
            }
          />
        </label>

        <label className="grid gap-1">
          <span>Received Date</span>
          <input
            name="receivedAt"
            type="date"
            className="rounded border px-3 py-2"
            defaultValue={
              holdingDeposit?.receivedAt
                ? new Date(holdingDeposit.receivedAt).toISOString().slice(0, 10)
                : ""
            }
          />
        </label>

        <label className="grid gap-1">
          <span>Deadline</span>
          <input
            name="deadlineAt"
            type="date"
            className="rounded border px-3 py-2"
            defaultValue={
              holdingDeposit?.deadlineAt
                ? new Date(holdingDeposit.deadlineAt).toISOString().slice(0, 10)
                : ""
            }
          />
        </label>

        <button className="rounded bg-black px-4 py-2 text-white">
          Save Holding Deposit
        </button>
      </form>

      {holdingDeposit && (
        <div className="rounded border bg-white p-4">
          <h2 className="font-semibold">Current Holding Deposit</h2>
          <p>
            Requested: £
            {typeof holdingDeposit.amountRequestedPence === "number"
              ? (holdingDeposit.amountRequestedPence / 100).toFixed(2)
              : "0.00"}
          </p>
          <p>
            Received: £
            {typeof holdingDeposit.amountReceivedPence === "number"
              ? (holdingDeposit.amountReceivedPence / 100).toFixed(2)
              : "0.00"}
          </p>
          <p>Status: {holdingDeposit.status}</p>
        </div>
      )}
    </div>
  );
}
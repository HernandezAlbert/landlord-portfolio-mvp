import Link from "next/link";
import {
  ApplicantStatus,
  HoldingDepositAppliedTo,
  HoldingDepositStatus,
} from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getRent(
  userId: string,
  propertyId: string | null | undefined,
  advertisedRentMonthly: number | null,
) {
  if (advertisedRentMonthly) return advertisedRentMonthly;
  if (!propertyId) return 0;

  const tenancy = await prisma.tenancy.findFirst({
    where: {
      propertyId,
      isActive: true,
      deletedAt: null,
      property: {
        userId,
      },
    },
    orderBy: { startDate: "desc" },
  });

  return tenancy?.rentMonthly ?? 0;
}

function calculateWeeklyRentFromMonthlyPence(monthly: number) {
  return Math.round((monthly * 12) / 52);
}

function defaultDeadlineFromReceived(receivedAt: Date) {
  const d = new Date(receivedAt);
  d.setDate(d.getDate() + 15);
  return d;
}

function fmtDateInput(value?: Date | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function fmtMoney(pence?: number | null) {
  return `£${((pence ?? 0) / 100).toFixed(2)}`;
}

const INCOMPATIBLE_APPLICANT_STATUSES = new Set<ApplicantStatus>([
  ApplicantStatus.DECLINED,
  ApplicantStatus.WITHDRAWN,
  ApplicantStatus.HOLDING_DEPOSIT_EXPIRED,
]);

const ACTIVE_HOLDING_DEPOSIT_STATUSES = new Set<HoldingDepositStatus>([
  HoldingDepositStatus.PENDING,
  HoldingDepositStatus.RECEIVED,
]);

function getIncompatibleStatusMessage(status: ApplicantStatus) {
  switch (status) {
    case ApplicantStatus.DECLINED:
      return "Holding deposit cannot be recorded for a declined applicant.";
    case ApplicantStatus.WITHDRAWN:
      return "Holding deposit cannot be recorded for a withdrawn applicant.";
    case ApplicantStatus.HOLDING_DEPOSIT_EXPIRED:
      return "Holding deposit cannot be recorded because this applicant is already marked as holding deposit expired.";
    default:
      return "Holding deposit cannot be recorded for this applicant in the current status.";
  }
}

async function getOwnedApplicant(userId: string, applicantId: string) {
  return prisma.applicant.findFirst({
    where: {
      id: applicantId,
      userId,
    },
    include: {
      property: true,
      holdingDeposit: true,
    },
  });
}

async function getConflictingActiveHoldingDeposit(
  userId: string,
  propertyId: string | null | undefined,
  applicantId: string,
) {
  if (!propertyId) return null;

  return prisma.holdingDeposit.findFirst({
    where: {
      propertyId,
      applicantId: {
        not: applicantId,
      },
      status: {
        in: Array.from(ACTIVE_HOLDING_DEPOSIT_STATUSES),
      },
      applicant: {
        userId,
      },
    },
    include: {
      applicant: {
        select: {
          id: true,
          fullName: true,
          status: true,
        },
      },
    },
  });
}

export default async function ApplicantHoldingDepositPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const { id } = await params;
  const qs = await searchParams;
  const actionStatus = qs?.status ?? "";

  const applicant = await getOwnedApplicant(sessionUser.id, id);

  if (!applicant) notFound();

  const rentMonthly = await getRent(
    sessionUser.id,
    applicant.propertyId,
    applicant.property?.advertisedRentMonthly ?? null,
  );

  const weeklyRentPence = calculateWeeklyRentFromMonthlyPence(rentMonthly);
  const holdingDeposit = applicant.holdingDeposit;
  const isIncompatibleStatus = INCOMPATIBLE_APPLICANT_STATUSES.has(applicant.status);
  const incompatibleMessage = isIncompatibleStatus
    ? getIncompatibleStatusMessage(applicant.status)
    : null;

  const conflictingActiveHoldingDeposit =
    await getConflictingActiveHoldingDeposit(
      sessionUser.id,
      applicant.propertyId,
      applicant.id,
    );

  const hasPropertyConflict = Boolean(conflictingActiveHoldingDeposit);
  const propertyConflictMessage = conflictingActiveHoldingDeposit
    ? `This property already has an active holding deposit for ${conflictingActiveHoldingDeposit.applicant.fullName} (${conflictingActiveHoldingDeposit.status}).`
    : null;

  async function saveHoldingDeposit(formData: FormData) {
    "use server";

    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      redirect("/login");
    }

    const applicantId = String(formData.get("applicantId") ?? "").trim();
    const amountPounds = Number(formData.get("amountRequested") ?? 0);
    const receivedDateRaw = String(formData.get("receivedAt") ?? "").trim();
    const deadlineRaw = String(formData.get("deadlineAt") ?? "").trim();

    if (!applicantId || !amountPounds) {
      redirect(`/applicants/${id}/holding-deposit`);
    }

    const freshApplicant = await getOwnedApplicant(sessionUser.id, applicantId);

    if (!freshApplicant) {
      redirect("/applicants");
    }

    if (INCOMPATIBLE_APPLICANT_STATUSES.has(freshApplicant.status)) {
      redirect(`/applicants/${id}/holding-deposit`);
    }

    const conflictingDeposit = await getConflictingActiveHoldingDeposit(
      sessionUser.id,
      freshApplicant.propertyId,
      freshApplicant.id,
    );

    if (conflictingDeposit) {
      redirect(`/applicants/${id}/holding-deposit`);
    }

    const amountRequestedPence = Math.round(amountPounds * 100);

    const resolvedRentMonthly = await getRent(
      sessionUser.id,
      freshApplicant.propertyId,
      freshApplicant.property?.advertisedRentMonthly ?? null,
    );

    const weeklyRentSnapshotPence =
      calculateWeeklyRentFromMonthlyPence(resolvedRentMonthly);

    const receivedAt = receivedDateRaw ? new Date(receivedDateRaw) : new Date();
    const deadlineAt = deadlineRaw
      ? new Date(deadlineRaw)
      : defaultDeadlineFromReceived(receivedAt);

    const existing = await prisma.holdingDeposit.findFirst({
      where: {
        applicantId,
      },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.holdingDeposit.updateMany({
          where: {
            applicantId,
          },
          data: {
            amountRequestedPence,
            amountReceivedPence: amountRequestedPence,
            weeklyRentSnapshotPence,
            receivedAt,
            deadlineAt,
            status: HoldingDepositStatus.RECEIVED,
            outcomeReason: null,
            refundedAt: null,
            retainedAt: null,
            appliedAt: null,
            appliedTo: null,
          },
        });
      } else {
        await tx.holdingDeposit.create({
          data: {
            applicantId,
            propertyId: freshApplicant.propertyId ?? null,
            amountRequestedPence,
            amountReceivedPence: amountRequestedPence,
            weeklyRentSnapshotPence,
            receivedAt,
            deadlineAt,
            status: HoldingDepositStatus.RECEIVED,
          },
        });
      }

      await tx.applicant.updateMany({
        where: {
          id: freshApplicant.id,
          userId: sessionUser.id,
          status: {
            notIn: [
              ApplicantStatus.DECLINED,
              ApplicantStatus.WITHDRAWN,
              ApplicantStatus.HOLDING_DEPOSIT_EXPIRED,
            ],
          },
        },
        data: {
          status: ApplicantStatus.RESERVED,
        },
      });
    });

    redirect(`/applicants/${id}/holding-deposit?status=saved`);
  }

  async function transitionHoldingDeposit(
    nextStatus: HoldingDepositStatus,
    options?: {
      appliedTo?: HoldingDepositAppliedTo;
      outcomeReason?: string | null;
    },
  ) {
    "use server";

    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      redirect("/login");
    }

    const freshApplicant = await getOwnedApplicant(sessionUser.id, id);

    if (!freshApplicant?.holdingDeposit) {
      redirect(`/applicants/${id}/holding-deposit`);
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.holdingDeposit.updateMany({
        where: {
          applicantId: id,
        },
        data: {
          status: nextStatus,
          outcomeReason: options?.outcomeReason ?? null,
          refundedAt:
            nextStatus === HoldingDepositStatus.REFUNDED ? now : null,
          retainedAt:
            nextStatus === HoldingDepositStatus.RETAINED ? now : null,
          appliedAt:
            nextStatus === HoldingDepositStatus.APPLIED ? now : null,
          appliedTo:
            nextStatus === HoldingDepositStatus.APPLIED
              ? options?.appliedTo ?? null
              : null,
        },
      });

      if (
        nextStatus === HoldingDepositStatus.CANCELLED ||
        nextStatus === HoldingDepositStatus.REFUNDED ||
        nextStatus === HoldingDepositStatus.RETAINED
      ) {
        await tx.applicant.updateMany({
          where: {
            id,
            userId: sessionUser.id,
            status: ApplicantStatus.RESERVED,
          },
          data: {
            status: ApplicantStatus.REFERENCING,
          },
        });
      }
    });

    redirect(`/applicants/${id}/holding-deposit?status=updated`);
  }

  async function cancelHoldingDeposit() {
    "use server";
    await transitionHoldingDeposit(HoldingDepositStatus.CANCELLED, {
      outcomeReason: "Cancelled",
    });
  }

  async function refundHoldingDeposit() {
    "use server";
    await transitionHoldingDeposit(HoldingDepositStatus.REFUNDED, {
      outcomeReason: "Refunded",
    });
  }

  async function retainHoldingDeposit() {
    "use server";
    await transitionHoldingDeposit(HoldingDepositStatus.RETAINED, {
      outcomeReason: "Retained",
    });
  }

  async function applyToFirstRent() {
    "use server";
    await transitionHoldingDeposit(HoldingDepositStatus.APPLIED, {
      appliedTo: HoldingDepositAppliedTo.FIRST_RENT,
      outcomeReason: "Applied to first rent",
    });
  }

  async function applyToTenancyDeposit() {
    "use server";
    await transitionHoldingDeposit(HoldingDepositStatus.APPLIED, {
      appliedTo: HoldingDepositAppliedTo.TENANCY_DEPOSIT,
      outcomeReason: "Applied to tenancy deposit",
    });
  }

  const canSave =
    !isIncompatibleStatus && !hasPropertyConflict;

  return (
    <div className="grid max-w-4xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Holding Deposit</h1>

        <Link
          href={`/applicants/${applicant.id}`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Back to Applicant
        </Link>
      </div>

      {actionStatus === "saved" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Holding deposit saved and applicant marked as Reserved.
        </div>
      ) : null}

      {actionStatus === "updated" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Holding deposit updated successfully.
        </div>
      ) : null}

      {incompatibleMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {incompatibleMessage}
        </div>
      ) : null}

      {propertyConflictMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {propertyConflictMessage}
        </div>
      ) : null}

      <div className="rounded border bg-white p-4">
        <p>
          <strong>Applicant:</strong> {applicant.fullName}
        </p>
        <p>
          <strong>Applicant Status:</strong> {applicant.status}
        </p>
        <p>
          <strong>Property:</strong> {applicant.property?.name ?? "—"}
        </p>
        <p>
          <strong>Monthly Rent:</strong> {fmtMoney(rentMonthly)}
        </p>
        <p>
          <strong>Weekly Rent:</strong> {fmtMoney(weeklyRentPence)}
        </p>
      </div>

      <form
        action={saveHoldingDeposit}
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
            disabled={!canSave}
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
            disabled={!canSave}
            className="rounded border px-3 py-2"
            defaultValue={fmtDateInput(holdingDeposit?.receivedAt)}
          />
        </label>

        <label className="grid gap-1">
          <span>Deadline</span>
          <input
            name="deadlineAt"
            type="date"
            disabled={!canSave}
            className="rounded border px-3 py-2"
            defaultValue={fmtDateInput(holdingDeposit?.deadlineAt)}
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/applicants/${applicant.id}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </Link>

          <button
            disabled={!canSave}
            className="rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {holdingDeposit ? "Update Holding Deposit" : "Save Holding Deposit"}
          </button>
        </div>
      </form>

      {holdingDeposit && (
        <div className="grid gap-4 rounded border bg-white p-4">
          <div>
            <h2 className="font-semibold">Current Holding Deposit</h2>
            <p>Requested: {fmtMoney(holdingDeposit.amountRequestedPence)}</p>
            <p>
              Received: {fmtMoney(holdingDeposit.amountReceivedPence)}
            </p>
            <p>Status: {holdingDeposit.status}</p>
            <p>Deadline: {fmtDateInput(holdingDeposit.deadlineAt)}</p>
            <p>
              Applied To:{" "}
              {holdingDeposit.appliedTo ? holdingDeposit.appliedTo : "—"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <form action={cancelHoldingDeposit}>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                Cancel Deposit
              </button>
            </form>

            <form action={refundHoldingDeposit}>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                Refund
              </button>
            </form>

            <form action={retainHoldingDeposit}>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                Retain
              </button>
            </form>

            <form action={applyToFirstRent}>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                Apply to First Rent
              </button>
            </form>

            <form action={applyToTenancyDeposit}>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                Apply to Tenancy Deposit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
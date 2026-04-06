import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/applicants";
import {
  calculateWeeklyRentFromMonthlyPence,
  defaultHoldingDepositDeadline,
  formatAppliedTo,
  formatHoldingDepositStatus,
  isActiveHoldingDepositStatus,
  validateHoldingDepositAmount,
} from "@/lib/holding-deposits";
import SubmitActionButton from "@/components/ui/submit-action-button";

async function getRent(propertyId?: string | null, advertisedRent?: number | null) {
  if (advertisedRent && advertisedRent > 0) return advertisedRent;
  if (!propertyId) return null;

  const activeTenancy = await prisma.tenancy.findFirst({
    where: { propertyId, isActive: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { rentMonthly: true },
  });

  return activeTenancy?.rentMonthly ?? null;
}

function fmtDate(value?: Date | null) {
  if (!value) return "—";
  return value.toISOString().slice(0, 10);
}

export default async function ApplicantHoldingDepositPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const qs = (await searchParams) ?? {};

  const applicant = await prisma.applicant.findUnique({
    where: { id },
    include: {
      property: true,
      holdingDeposits: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!applicant) notFound();

  const rentMonthly = await getRent(
    applicant.propertyId,
    applicant.property?.advertisedRentMonthly ?? null,
  );
  const weeklyRentPence = calculateWeeklyRentFromMonthlyPence(rentMonthly);
  const latestActive = applicant.holdingDeposits.find((d) => isActiveHoldingDepositStatus(d.status));

  async function createHoldingDeposit(formData: FormData) {
    "use server";

    const applicantId = String(formData.get("applicantId") ?? "");
    const amountPounds = Number(formData.get("amountRequested") ?? 0);
    const receivedDateRaw = String(formData.get("receivedAt") ?? "");
    const customDeadlineRaw = String(formData.get("deadlineAt") ?? "");

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { property: true },
    });

    if (!applicant) redirect("/applicants");

    const rentMonthly = applicant.property?.advertisedRentMonthly
      ? applicant.property.advertisedRentMonthly
      : (
          await prisma.tenancy.findFirst({
            where: { propertyId: applicant.propertyId ?? "", isActive: true, deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: { rentMonthly: true },
          })
        )?.rentMonthly ?? null;

    const weeklyRentPence = calculateWeeklyRentFromMonthlyPence(rentMonthly);
    const amountRequestedPence = Math.round(amountPounds * 100);
    const validationError = validateHoldingDepositAmount({
      requestedPence: amountRequestedPence,
      weeklyRentPence,
    });

    if (validationError) {
      redirect(`/applicants/${applicantId}/holding-deposit?error=${encodeURIComponent(validationError)}`);
    }

    const existingActive = await prisma.holdingDeposit.findFirst({
      where: {
        propertyId: applicant.propertyId ?? undefined,
        status: { in: ["PENDING", "RECEIVED"] },
      },
      select: { id: true },
    });

    if (existingActive) {
      redirect(
        `/applicants/${applicantId}/holding-deposit?error=${encodeURIComponent(
          "There is already a live holding deposit for this property.",
        )}`,
      );
    }

    const receivedAt = receivedDateRaw ? new Date(receivedDateRaw) : new Date();
    const deadlineAt = customDeadlineRaw
      ? new Date(customDeadlineRaw)
      : defaultHoldingDepositDeadline(receivedAt);

    await prisma.holdingDeposit.create({
      data: {
        applicantId,
        propertyId: applicant.propertyId ?? null,
        amountRequestedPence,
        amountReceivedPence: amountRequestedPence,
        weeklyRentSnapshotPence: weeklyRentPence || null,
        receivedAt,
        deadlineAt,
        status: "RECEIVED",
      },
    });

    revalidatePath(`/applicants/${applicantId}`);
    revalidatePath(`/applicants/${applicantId}/holding-deposit`);
    revalidatePath("/holding-deposits");

    redirect(
      `/applicants/${applicantId}/holding-deposit?success=${encodeURIComponent("Holding deposit recorded.")}`,
    );
  }

  async function processHoldingDeposit(formData: FormData) {
    "use server";

    const depositId = String(formData.get("depositId") ?? "");
    const applicantId = String(formData.get("applicantId") ?? "");
    const action = String(formData.get("actionType") ?? "");
    const outcomeReason = String(formData.get("outcomeReason") ?? "").trim();
    const appliedTo = String(formData.get("appliedTo") ?? "").trim();
    const consentToApply = String(formData.get("consentToApply") ?? "") === "true";
    const tenancySignedConfirmed = String(formData.get("tenancySignedConfirmed") ?? "") === "true";

    const deposit = await prisma.holdingDeposit.findUnique({
      where: { id: depositId },
    });

    if (!deposit) {
      redirect(`/applicants/${applicantId}/holding-deposit?error=${encodeURIComponent("Holding deposit not found.")}`);
    }

    if (action === "refund") {
      await prisma.holdingDeposit.update({
        where: { id: depositId },
        data: {
          status: "REFUNDED",
          refundedAt: new Date(),
          outcomeReason: outcomeReason || null,
        },
      });
    } else if (action === "retain") {
      if (!outcomeReason) {
        redirect(
          `/applicants/${applicantId}/holding-deposit?error=${encodeURIComponent(
            "A written reason is required when retaining a holding deposit.",
          )}`,
        );
      }

      await prisma.holdingDeposit.update({
        where: { id: depositId },
        data: {
          status: "RETAINED",
          retainedAt: new Date(),
          outcomeReason,
        },
      });
    } else if (action === "apply") {
      if (!consentToApply || !tenancySignedConfirmed) {
        redirect(
          `/applicants/${applicantId}/holding-deposit?error=${encodeURIComponent(
            "You must confirm tenant consent and that the tenancy has been signed before applying the holding deposit.",
          )}`,
        );
      }

      if (appliedTo !== "FIRST_RENT" && appliedTo !== "TENANCY_DEPOSIT") {
        redirect(
          `/applicants/${applicantId}/holding-deposit?error=${encodeURIComponent(
            "Choose whether the holding deposit is being applied to first rent or the tenancy deposit.",
          )}`,
        );
      }

      await prisma.holdingDeposit.update({
        where: { id: depositId },
        data: {
          status: "APPLIED",
          appliedAt: new Date(),
          appliedTo: appliedTo as "FIRST_RENT" | "TENANCY_DEPOSIT",
          consentToApply: true,
          tenancySignedConfirmed: true,
          outcomeReason: outcomeReason || null,
        },
      });
    } else if (action === "expire") {
      await prisma.holdingDeposit.update({
        where: { id: depositId },
        data: {
          status: "EXPIRED",
          outcomeReason: outcomeReason || null,
        },
      });
    }

    revalidatePath(`/applicants/${applicantId}`);
    revalidatePath(`/applicants/${applicantId}/holding-deposit`);
    revalidatePath("/holding-deposits");

    redirect(
      `/applicants/${applicantId}/holding-deposit?success=${encodeURIComponent("Holding deposit updated.")}`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Holding deposit</h1>
          <p className="text-sm text-slate-600">
            {applicant.fullName} · {applicant.property?.name ?? "No property linked"}
          </p>
        </div>
        <Link href={`/applicants/${applicant.id}`} className="btn btn-secondary">
          Back to applicant
        </Link>
      </div>

      {qs.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {qs.error}
        </div>
      ) : null}

      {qs.success ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {qs.success}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Monthly rent used</div>
          <div className="mt-2 text-xl font-semibold">{rentMonthly ? formatMoney(rentMonthly) : "Not set"}</div>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Maximum holding deposit</div>
          <div className="mt-2 text-xl font-semibold">{weeklyRentPence ? formatMoney(weeklyRentPence) : "Not available"}</div>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Live deposit</div>
          <div className="mt-2 text-xl font-semibold">
            {latestActive ? formatHoldingDepositStatus(latestActive.status) : "None"}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Record new holding deposit</h2>
        <p className="mt-1 text-sm text-slate-600">
          Keep this separate from rent and only apply it later once the tenancy is signed.
        </p>

        <form action={createHoldingDeposit} className="mt-4 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="applicantId" value={applicant.id} />

          <label className="space-y-1">
            <span className="text-sm font-medium">Amount requested (£)</span>
            <input
              type="number"
              name="amountRequested"
              min="0"
              step="0.01"
              max={weeklyRentPence ? (weeklyRentPence / 100).toFixed(2) : undefined}
              className="w-full rounded-xl border px-3 py-2"
              required
              disabled={!!latestActive}
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Received date</span>
            <input
              type="date"
              name="receivedAt"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-xl border px-3 py-2"
              disabled={!!latestActive}
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium">Custom deadline (optional)</span>
            <input type="date" name="deadlineAt" className="w-full rounded-xl border px-3 py-2" disabled={!!latestActive} />
          </label>

          <div className="md:col-span-2">
            <SubmitActionButton
              idleLabel={latestActive ? "Live holding deposit already exists" : "Record holding deposit"}
              pendingLabel="Saving holding deposit..."
              variant="primary"
            />
          </div>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold">History</h2>

        {!applicant.holdingDeposits.length ? (
          <p className="mt-3 text-sm text-slate-600">No holding deposits recorded for this applicant.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {applicant.holdingDeposits.map((deposit) => (
              <div key={deposit.id} className="rounded-2xl border p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                    <div className="font-medium">{formatHoldingDepositStatus(deposit.status)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Amount</div>
                    <div className="font-medium">{formatMoney(deposit.amountReceivedPence ?? deposit.amountRequestedPence)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Deadline</div>
                    <div className="font-medium">{fmtDate(deposit.deadlineAt)}</div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Received</div>
                    <div>{fmtDate(deposit.receivedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Applied to</div>
                    <div>{formatAppliedTo(deposit.appliedTo)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Reason / note</div>
                    <div>{deposit.outcomeReason || "—"}</div>
                  </div>
                </div>

                {deposit.status === "RECEIVED" || deposit.status === "PENDING" ? (
                  <form action={processHoldingDeposit} className="mt-4 grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="depositId" value={deposit.id} />
                    <input type="hidden" name="applicantId" value={applicant.id} />

                    <label className="space-y-1 md:col-span-2">
                      <span className="text-sm font-medium">Outcome reason / note</span>
                      <textarea name="outcomeReason" rows={3} className="w-full rounded-xl border px-3 py-2" />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm font-medium">Apply to</span>
                      <select name="appliedTo" className="w-full rounded-xl border px-3 py-2" defaultValue="">
                        <option value="">Select…</option>
                        <option value="FIRST_RENT">First rent</option>
                        <option value="TENANCY_DEPOSIT">Tenancy deposit</option>
                      </select>
                    </label>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="consentToApply" value="true" />
                        Tenant consent received
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="tenancySignedConfirmed" value="true" />
                        Tenancy signed
                      </label>
                    </div>

                    <div className="md:col-span-2 flex flex-wrap gap-2">
                      <button type="submit" name="actionType" value="refund" className="btn btn-secondary">
                        Refund
                      </button>
                      <button type="submit" name="actionType" value="retain" className="btn btn-danger">
                        Retain
                      </button>
                      <button type="submit" name="actionType" value="apply" className="btn btn-primary">
                        Apply
                      </button>
                      <button type="submit" name="actionType" value="expire" className="btn btn-secondary">
                        Mark expired
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
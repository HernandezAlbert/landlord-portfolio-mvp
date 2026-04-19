import Link from "next/link";
import { ReportStatus, ReportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  formatDate,
  getReminderDays,
  getReportingDashboardData,
} from "@/lib/reporting";
import SubmitButton from "@/components/SubmitButton";
import GenerateReportButton from "@/components/GenerateReportButton";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth";

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildRunLink(status: string, limit: number) {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.set("status", status);
  if (limit !== 12) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `/finance/reporting?${qs}` : "/finance/reporting";
}

function getSnapshotOwnerUserId(run: {
  snapshots: Array<{
    summaryJson: { ownerUserId?: string } | null;
    warningsJson: { ownerUserId?: string } | null;
  }>;
}) {
  const latest = run.snapshots[0];
  return (
    latest?.summaryJson?.ownerUserId ||
    latest?.warningsJson?.ownerUserId ||
    null
  );
}

export default async function ReportingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await requireSessionUser();
  const resolvedSearchParams = (await searchParams) || {};
  const selectedStatus =
    typeof resolvedSearchParams.status === "string"
      ? resolvedSearchParams.status
      : "ALL";
  const selectedLimit =
    typeof resolvedSearchParams.limit === "string"
      ? Number(resolvedSearchParams.limit) || 12
      : 12;

  const data = await getReportingDashboardData(sessionUser.id, {
    status: ["DRAFT", "NEEDS_REVIEW", "READY", "EXPORTED"].includes(
      selectedStatus
    )
      ? (selectedStatus as ReportStatus)
      : "ALL",
    limit: selectedLimit,
  });

  async function saveSchedule(formData: FormData) {
    "use server";

    try {
      const sessionUser = await requireSessionUser();
      const type = String(formData.get("type") || "ANNUAL") as ReportType;
      const propertyId = String(formData.get("propertyId") || "") || null;
      const daysBeforeDue = Math.max(
        0,
        Number(formData.get("daysBeforeDue") || 7) || 7
      );
      const reminderDays =
        String(formData.get("reminderDays") || "14,7,3,1").trim() ||
        "14,7,3,1";
      const isActive = formData.get("isActive") === "on";
      const autoGenerate = formData.get("autoGenerate") === "on";
      const reminderEnabled = formData.get("reminderEnabled") === "on";

      if (!propertyId) return;

      const ownedProperty = await prisma.property.findFirst({
        where: {
          id: propertyId,
          userId: sessionUser.id,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!ownedProperty) return;

      await prisma.reportSchedule.create({
        data: {
          type,
          propertyId,
          daysBeforeDue,
          reminderDays,
          isActive,
          autoGenerate,
          reminderEnabled,
        },
      });

      revalidatePath("/finance/reporting");
    } catch (error) {
      console.error("saveSchedule failed:", error);
      return;
    }
  }

  async function updateRun(formData: FormData) {
    "use server";

    try {
      const sessionUser = await requireSessionUser();
      const runId = String(formData.get("runId") || "");
      const status = String(formData.get("status") || "DRAFT") as ReportStatus;

      if (!runId) return;

      const run = await prisma.reportRun.findFirst({
        where: {
          id: runId,
          OR: [
            { property: { userId: sessionUser.id, deletedAt: null } },
            { propertyId: null },
          ],
        },
        select: {
          id: true,
          propertyId: true,
          property: {
            select: { userId: true, deletedAt: true },
          },
          snapshots: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              summaryJson: true,
              warningsJson: true,
            },
          },
        },
      });

      if (!run) return;

      if (run.propertyId) {
        if (
          !run.property ||
          run.property.deletedAt ||
          run.property.userId !== sessionUser.id
        ) {
          return;
        }
      } else {
        const ownerUserId = getSnapshotOwnerUserId({
          snapshots: run.snapshots.map((snapshot) => ({
            summaryJson:
              (snapshot.summaryJson as { ownerUserId?: string } | null) ?? null,
            warningsJson:
              (snapshot.warningsJson as { ownerUserId?: string } | null) ?? null,
          })),
        });

        if (!ownerUserId || ownerUserId !== sessionUser.id) return;
      }

      const finalisedAt =
        status === "READY" || status === "EXPORTED" ? new Date() : null;

      await prisma.reportRun.update({
        where: { id: runId },
        data: { status, finalisedAt },
      });

      revalidatePath("/finance/reporting");
    } catch (error) {
      console.error("updateRun failed:", error);
      return;
    }
  }

  async function deleteRun(formData: FormData) {
    "use server";

    try {
      const sessionUser = await requireSessionUser();
      const runId = String(formData.get("runId") || "");
      if (!runId) return;

      const run = await prisma.reportRun.findFirst({
        where: {
          id: runId,
          OR: [
            { property: { userId: sessionUser.id, deletedAt: null } },
            { propertyId: null },
          ],
        },
        select: {
          id: true,
          propertyId: true,
          property: {
            select: { userId: true, deletedAt: true },
          },
          snapshots: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              summaryJson: true,
              warningsJson: true,
            },
          },
        },
      });

      if (!run) return;

      if (run.propertyId) {
        if (
          !run.property ||
          run.property.deletedAt ||
          run.property.userId !== sessionUser.id
        ) {
          return;
        }
      } else {
        const ownerUserId = getSnapshotOwnerUserId({
          snapshots: run.snapshots.map((snapshot) => ({
            summaryJson:
              (snapshot.summaryJson as { ownerUserId?: string } | null) ?? null,
            warningsJson:
              (snapshot.warningsJson as { ownerUserId?: string } | null) ?? null,
          })),
        });

        if (!ownerUserId || ownerUserId !== sessionUser.id) return;
      }

      await prisma.reportRun.delete({
        where: { id: runId },
      });

      revalidatePath("/finance/reporting");
    } catch (error) {
      console.error("deleteRun failed:", error);
      return;
    }
  }

  async function cleanupRuns(formData: FormData) {
    "use server";

    try {
      const sessionUser = await requireSessionUser();
      const mode = String(formData.get("mode") || "exported");

      const rawRuns = await prisma.reportRun.findMany({
        where: {
          OR: [
            { property: { userId: sessionUser.id, deletedAt: null } },
            { propertyId: null },
          ],
        },
        select: {
          id: true,
          status: true,
          generatedAt: true,
          propertyId: true,
          property: {
            select: { userId: true, deletedAt: true },
          },
          snapshots: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              summaryJson: true,
              warningsJson: true,
            },
          },
        },
        orderBy: { generatedAt: "desc" },
        take: 500,
      });

      const ownedRuns = rawRuns.filter((run) => {
        if (run.propertyId) {
          return (
            !!run.property &&
            !run.property.deletedAt &&
            run.property.userId === sessionUser.id
          );
        }

        const ownerUserId = getSnapshotOwnerUserId({
          snapshots: run.snapshots.map((snapshot) => ({
            summaryJson:
              (snapshot.summaryJson as { ownerUserId?: string } | null) ?? null,
            warningsJson:
              (snapshot.warningsJson as { ownerUserId?: string } | null) ?? null,
          })),
        });

        return ownerUserId === sessionUser.id;
      });

      if (mode === "exported") {
        const deleteIds = ownedRuns
          .filter((run) => run.status === "EXPORTED")
          .map((run) => run.id);

        if (deleteIds.length) {
          await prisma.reportRun.deleteMany({
            where: { id: { in: deleteIds } },
          });
        }
      }

      if (mode === "older") {
        const keepIds = ownedRuns.slice(0, 20).map((run) => run.id);
        const deleteIds = ownedRuns
          .filter((run) => !keepIds.includes(run.id))
          .map((run) => run.id);

        if (deleteIds.length) {
          await prisma.reportRun.deleteMany({
            where: { id: { in: deleteIds } },
          });
        }
      }

      revalidatePath("/finance/reporting");
    } catch (error) {
      console.error("cleanupRuns failed:", error);
      return;
    }
  }

  const filters: Array<{ label: string; value: string; count: number }> = [
    { label: "All", value: "ALL", count: data.counts.ALL },
    { label: "Draft", value: "DRAFT", count: data.counts.DRAFT },
    {
      label: "Needs review",
      value: "NEEDS_REVIEW",
      count: data.counts.NEEDS_REVIEW,
    },
    { label: "Ready", value: "READY", count: data.counts.READY },
    { label: "Exported", value: "EXPORTED", count: data.counts.EXPORTED },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Reporting & accountant pack
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Generate annual or quarterly reports, keep draft snapshots, and set
              reminders / auto-generation rules.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/finance" className="btn btn-secondary btn-sm">
              Back to finance
            </Link>
            <Link
              href="/finance/reporting/scheduler"
              className="btn btn-secondary btn-sm"
            >
              Run scheduler
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">
            Generate report now
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Create a draft pack instantly. You can export summary CSV, detailed
            CSV, PDF, or a bundled accountant pack from the runs below.
          </p>
          <div className="mt-3 text-sm text-slate-700">
            Current tax year {data.currentTaxYearStart}/
            {String(data.currentTaxYearStart + 1).slice(-2)}
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-900">
              Annual accountant pack
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Includes all income and expenses for the selected tax year across
              your portfolio.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.availableYears.map((year) => (
                <GenerateReportButton
                  key={`annual-${year}`}
                  type="ANNUAL"
                  year={year}
                  className="btn btn-primary btn-sm min-w-[10rem] justify-center"
                  label={`Annual ${year}/${String(year + 1).slice(-2)}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-900">
              Quarterly draft
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Generate quarter-by-quarter snapshots aligned to the UK tax year.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[1, 2, 3, 4].map((quarter) => (
                <GenerateReportButton
                  key={`q-${quarter}`}
                  type="QUARTERLY"
                  year={data.currentTaxYearStart}
                  quarter={quarter}
                  className="btn btn-secondary btn-sm justify-center"
                  label={`Q${quarter} ${data.currentTaxYearStart}/${String(
                    data.currentTaxYearStart + 1
                  ).slice(-2)}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">
            Schedules & reminders
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Optional automation for draft generation and reminder emails.
          </p>

          <form action={saveSchedule} className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Report type</span>
                <select name="type" className="input">
                  <option value="ANNUAL">Annual</option>
                  <option value="QUARTERLY">Quarterly</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Property scope</span>
                <select name="propertyId" className="input" defaultValue="">
                  <option value="">All properties</option>
                  {data.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">
                  Auto-generate days before due
                </span>
                <input
                  name="daysBeforeDue"
                  type="number"
                  min={0}
                  defaultValue={7}
                  className="input"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Reminder days CSV</span>
                <input
                  name="reminderDays"
                  type="text"
                  defaultValue="14,7,3,1"
                  className="input"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input name="isActive" type="checkbox" defaultChecked />
                <span>Active</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input name="autoGenerate" type="checkbox" defaultChecked />
                <span>Auto-generate draft</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input name="reminderEnabled" type="checkbox" defaultChecked />
                <span>Send reminders</span>
              </label>
            </div>

            <div>
              <SubmitButton className="btn btn-primary btn-sm">
                Save schedule
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Saved schedules
            </div>
            <p className="mt-1 text-sm text-slate-500">
              These rules are used by the reporting cron endpoint.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            {data.schedules.length} total
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {data.schedules.length ? (
            data.schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="font-semibold text-slate-900">
                  {titleCase(schedule.type)} ·{" "}
                  {schedule.property?.name || "All properties"}
                </div>
                <div className="mt-1 text-slate-500">
                  {schedule.property?.name || "All properties"} · Generate{" "}
                  {schedule.daysBeforeDue} day(s) before due · Remind on{" "}
                  {getReminderDays(schedule.reminderDays).join(", ")} day(s)
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {schedule.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {schedule.autoGenerate ? "Auto" : "Manual only"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {schedule.reminderEnabled ? "Reminders on" : "Reminders off"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No schedules saved yet.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Recent report runs
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Filter the list, trim old runs, or delete exports you no longer
              need so the reporting area stays tidy.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            {data.runs.length} shown
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filters.map((filter) => {
            const active = data.selectedStatus === filter.value;
            return (
              <Link
                key={filter.value}
                href={buildRunLink(filter.value, data.limit)}
                className={`btn btn-sm ${
                  active ? "btn-primary" : "btn-secondary"
                }`}
              >
                {filter.label} ({filter.count})
              </Link>
            );
          })}

          {[12, 24, 50].map((limit) => (
            <Link
              key={limit}
              href={buildRunLink(data.selectedStatus, limit)}
              className={`btn btn-sm ${
                data.limit === limit ? "btn-primary" : "btn-secondary"
              }`}
            >
              Show {limit}
            </Link>
          ))}

          <form action={cleanupRuns}>
            <input type="hidden" name="mode" value="exported" />
            <SubmitButton className="btn btn-secondary btn-sm">
              Delete exported runs
            </SubmitButton>
          </form>

          <form action={cleanupRuns}>
            <input type="hidden" name="mode" value="older" />
            <SubmitButton className="btn btn-secondary btn-sm">
              Keep latest 20 only
            </SubmitButton>
          </form>
        </div>

        <div className="mt-4 space-y-4">
          {data.runs.length ? (
            data.runs.map((run) => {
              const latestSnapshot = run.snapshots[0];
              const warningPayload = latestSnapshot?.warningsJson as {
                items?: string[];
              } | null;
              const summary = latestSnapshot?.summaryJson as {
                totalIncome?: string;
                totalExpenses?: string;
                net?: string;
                propertyScope?: string;
              } | null;
              const warnings = warningPayload?.items || [];
              const displayTitle = `${titleCase(run.type)} report${
                run.property?.name ? ` — ${run.property.name}` : ""
              }`;

              return (
                <div
                  key={run.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {displayTitle}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {formatDate(run.periodStart)} to{" "}
                        {formatDate(run.periodEnd)} · Due{" "}
                        {formatDate(run.dueDate)} ·{" "}
                        {summary?.propertyScope ||
                          run.property?.name ||
                          "All properties"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {titleCase(run.status)} · Generated{" "}
                        {formatDate(run.generatedAt)} · {run.generatedBy}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-white px-3 py-2">
                        <div className="text-xs text-slate-500">Income</div>
                        <div className="font-semibold text-slate-900">
                          £{summary?.totalIncome || "0.00"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2">
                        <div className="text-xs text-slate-500">Expenses</div>
                        <div className="font-semibold text-slate-900">
                          £{summary?.totalExpenses || "0.00"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2">
                        <div className="text-xs text-slate-500">Net</div>
                        <div className="font-semibold text-slate-900">
                          £{summary?.net || "0.00"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <a
                      href={`/api/reports/${run.id}/summary.csv`}
                      className="btn btn-secondary btn-sm"
                    >
                      Export summary CSV
                    </a>
                    <a
                      href={`/api/reports/${run.id}/detailed.csv`}
                      className="btn btn-secondary btn-sm"
                    >
                      Export detailed CSV
                    </a>
                    <a
                      href={`/api/reports/${run.id}/pdf`}
                      className="btn btn-secondary btn-sm"
                    >
                      Export PDF
                    </a>
                    <a
                      href={`/api/reports/${run.id}/accountant-pack`}
                      className="btn btn-secondary btn-sm"
                    >
                      Download accountant pack
                    </a>
                  </div>

                  {warnings.length ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="text-sm font-semibold text-amber-900">
                        Review warnings
                      </div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
                        {warnings.map((warning, index) => (
                          <li key={`${run.id}-warning-${index}`}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <form
                      action={updateRun}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="runId" value={run.id} />
                      <select
                        name="status"
                        defaultValue={run.status}
                        className="input input-sm"
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="NEEDS_REVIEW">Needs review</option>
                        <option value="READY">Ready</option>
                        <option value="EXPORTED">Exported</option>
                      </select>
                      <SubmitButton className="btn btn-primary btn-sm">
                        Update report
                      </SubmitButton>
                    </form>

                    <form action={deleteRun}>
                      <input type="hidden" name="runId" value={run.id} />
                      <SubmitButton className="btn btn-secondary btn-sm">
                        Delete run
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No reports generated yet for this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
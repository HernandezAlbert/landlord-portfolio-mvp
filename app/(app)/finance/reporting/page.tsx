import Link from "next/link";
import { ReportStatus, ReportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDate, getReminderDays, getReportingDashboardData } from "@/lib/reporting";
import SubmitButton from "@/components/SubmitButton";
import GenerateReportButton from "@/components/GenerateReportButton";
import { revalidatePath } from "next/cache";

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildRunLink(status: string, limit: number) {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.set("status", status);
  if (limit !== 12) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `/finance/reporting?${qs}` : "/finance/reporting";
}

export default async function ReportingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const selectedStatus = typeof resolvedSearchParams.status === "string" ? resolvedSearchParams.status : "ALL";
  const selectedLimit = typeof resolvedSearchParams.limit === "string" ? Number(resolvedSearchParams.limit) || 12 : 12;
  const data = await getReportingDashboardData({
    status: ["DRAFT", "NEEDS_REVIEW", "READY", "EXPORTED"].includes(selectedStatus) ? (selectedStatus as ReportStatus) : "ALL",
    limit: selectedLimit,
  });

  async function saveSchedule(formData: FormData) {
    "use server";
    const type = String(formData.get("type") || "ANNUAL") as ReportType;
    const propertyId = String(formData.get("propertyId") || "") || null;
    const daysBeforeDue = Math.max(0, Number(formData.get("daysBeforeDue") || 7) || 7);
    const reminderDays = String(formData.get("reminderDays") || "14,7,3,1").trim() || "14,7,3,1";
    const isActive = formData.get("isActive") === "on";
    const autoGenerate = formData.get("autoGenerate") === "on";
    const reminderEnabled = formData.get("reminderEnabled") === "on";

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
  }

  async function updateRun(formData: FormData) {
    "use server";
    const runId = String(formData.get("runId") || "");
    const status = String(formData.get("status") || "DRAFT") as ReportStatus;
    const finalisedAt = status === "READY" || status === "EXPORTED" ? new Date() : null;

    await prisma.reportRun.update({
      where: { id: runId },
      data: { status, finalisedAt },
    });

    revalidatePath("/finance/reporting");
  }

  async function deleteRun(formData: FormData) {
    "use server";
    const runId = String(formData.get("runId") || "");
    if (!runId) return;
    await prisma.reportRun.delete({ where: { id: runId } });
    revalidatePath("/finance/reporting");
  }

  async function cleanupRuns(formData: FormData) {
    "use server";
    const mode = String(formData.get("mode") || "exported");

    if (mode === "exported") {
      await prisma.reportRun.deleteMany({ where: { status: "EXPORTED" } });
    }

    if (mode === "older") {
      const keep = 20;
      const recent = await prisma.reportRun.findMany({
        select: { id: true },
        orderBy: { generatedAt: "desc" },
        take: keep,
      });
      const keepIds = recent.map((item) => item.id);
      await prisma.reportRun.deleteMany({
        where: keepIds.length ? { id: { notIn: keepIds } } : undefined,
      });
    }

    revalidatePath("/finance/reporting");
  }

  const filters: Array<{ label: string; value: string; count: number }> = [
    { label: "All", value: "ALL", count: data.counts.ALL },
    { label: "Draft", value: "DRAFT", count: data.counts.DRAFT },
    { label: "Needs review", value: "NEEDS_REVIEW", count: data.counts.NEEDS_REVIEW },
    { label: "Ready", value: "READY", count: data.counts.READY },
    { label: "Exported", value: "EXPORTED", count: data.counts.EXPORTED },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reporting & accountant pack</h1>
          <p className="mt-1 text-sm text-slate-500">Generate annual or quarterly reports, keep draft snapshots, and set reminders / auto-generation rules.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/finance" className="btn btn-secondary btn-sm">Back to finance</Link>
          <a href="/api/cron/reports" className="btn btn-secondary btn-sm">Run scheduler</a>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="section-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="section-title">Generate report now</h2>
              <p className="section-subtitle">Create a draft pack instantly. You can export summary CSV, detailed CSV, PDF, or a bundled accountant pack from the runs below.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Current tax year {data.currentTaxYearStart}/{String(data.currentTaxYearStart + 1).slice(-2)}</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Annual accountant pack</div>
              <p className="mt-1 text-sm text-slate-500">Includes all income and expenses for the selected tax year across your portfolio.</p>
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Quarterly draft</div>
              <p className="mt-1 text-sm text-slate-500">Generate quarter-by-quarter snapshots aligned to the UK tax year.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[1, 2, 3, 4].map((quarter) => (
                  <GenerateReportButton
                    key={`q-${quarter}`}
                    type="QUARTERLY"
                    year={data.currentTaxYearStart}
                    quarter={quarter}
                    className="btn btn-primary btn-sm min-w-[10rem] justify-center"
                    label={`Q${quarter} ${data.currentTaxYearStart}/${String(data.currentTaxYearStart + 1).slice(-2)}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="section-title">Schedules & reminders</h2>
              <p className="section-subtitle">Optional automation for draft generation and reminder emails.</p>
            </div>
          </div>

          <form action={saveSchedule} className="mt-4 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Report type
                <select name="type" className="rounded-lg border border-slate-300 px-3 py-2 font-normal">
                  <option value="ANNUAL">Annual</option>
                  <option value="QUARTERLY">Quarterly</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Property scope
                <select name="propertyId" className="rounded-lg border border-slate-300 px-3 py-2 font-normal">
                  <option value="">All properties</option>
                  {data.properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Auto-generate days before due
                <input type="number" min="0" name="daysBeforeDue" defaultValue="7" className="rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Reminder days CSV
                <input name="reminderDays" defaultValue="14,7,3,1" className="rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700"><input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" /> Active</label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700"><input type="checkbox" name="autoGenerate" defaultChecked className="h-4 w-4" /> Auto-generate draft</label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700"><input type="checkbox" name="reminderEnabled" defaultChecked className="h-4 w-4" /> Send reminders</label>
            <SubmitButton>Save schedule</SubmitButton>
          </form>
        </section>
      </div>

      <section className="section-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="section-title">Saved schedules</h2>
            <p className="section-subtitle">These rules are used by the reporting cron endpoint.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{data.schedules.length} total</span>
        </div>
        <div className="mt-4 grid gap-3">
          {data.schedules.length ? data.schedules.map((schedule) => (
            <div key={schedule.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{titleCase(schedule.type)} · {schedule.property?.name || "All properties"}</div>
                  <div className="text-slate-500">{schedule.property?.name || "All properties"} · Generate {schedule.daysBeforeDue} day(s) before due · Remind on {getReminderDays(schedule.reminderDays).join(", ")} day(s)</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className={`rounded-full px-2.5 py-1 ${schedule.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{schedule.isActive ? "Active" : "Inactive"}</span>
                  <span className={`rounded-full px-2.5 py-1 ${schedule.autoGenerate ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{schedule.autoGenerate ? "Auto" : "Manual only"}</span>
                  <span className={`rounded-full px-2.5 py-1 ${schedule.reminderEnabled ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{schedule.reminderEnabled ? "Reminders on" : "Reminders off"}</span>
                </div>
              </div>
            </div>
          )) : <p className="text-sm text-slate-500">No schedules saved yet.</p>}
        </div>
      </section>

      <section className="section-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="section-title">Recent report runs</h2>
            <p className="section-subtitle">Filter the list, trim old runs, or delete exports you no longer need so the reporting area stays tidy.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{data.runs.length} shown</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filters.map((filter) => {
            const active = data.selectedStatus === filter.value;
            return (
              <Link
                key={filter.value}
                href={buildRunLink(filter.value, data.limit)}
                className={active ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              >
                {filter.label} ({filter.count})
              </Link>
            );
          })}
          <div className="ml-auto flex flex-wrap gap-2">
            {[12, 24, 50].map((limit) => (
              <Link
                key={limit}
                href={buildRunLink(data.selectedStatus, limit)}
                className={data.limit === limit ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              >
                Show {limit}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <form action={cleanupRuns}>
            <input type="hidden" name="mode" value="exported" />
            <button type="submit" className="btn btn-secondary btn-sm">
              Delete exported runs
            </button>
          </form>
          <form action={cleanupRuns}>
            <input type="hidden" name="mode" value="older" />
            <button type="submit" className="btn btn-secondary btn-sm">
              Keep latest 20 only
            </button>
          </form>
        </div>

        <div className="mt-4 space-y-4">
          {data.runs.length ? data.runs.map((run) => {
            const latestSnapshot = run.snapshots[0];
            const warningPayload = latestSnapshot?.warningsJson as { items?: string[] } | null;
            const summary = latestSnapshot?.summaryJson as { totalIncome?: string; totalExpenses?: string; net?: string; propertyScope?: string } | null;
            const warnings = warningPayload?.items || [];
            const displayTitle = `${titleCase(run.type)} report${run.property?.name ? ` — ${run.property.name}` : ""}`;

            return (
              <div key={run.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{displayTitle}</div>
                    <div className="mt-1 text-sm text-slate-500">{formatDate(run.periodStart)} to {formatDate(run.periodEnd)} · Due {formatDate(run.dueDate)} · {summary?.propertyScope || run.property?.name || "All properties"}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className={`rounded-full px-2.5 py-1 ${run.status === "READY" ? "bg-green-100 text-green-700" : run.status === "NEEDS_REVIEW" ? "bg-amber-100 text-amber-700" : run.status === "EXPORTED" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{titleCase(run.status)}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Generated {formatDate(run.generatedAt)} · {run.generatedBy}</span>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><div className="text-slate-500">Income</div><div className="font-semibold text-slate-900">£{summary?.totalIncome || "0.00"}</div></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><div className="text-slate-500">Expenses</div><div className="font-semibold text-slate-900">£{summary?.totalExpenses || "0.00"}</div></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><div className="text-slate-500">Net</div><div className="font-semibold text-slate-900">£{summary?.net || "0.00"}</div></div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`/api/export/report?runId=${run.id}&kind=summary`} className="btn btn-secondary btn-sm">Export summary CSV</a>
                  <a href={`/api/export/report?runId=${run.id}&kind=detailed`} className="btn btn-secondary btn-sm">Export detailed CSV</a>
                  <a href={`/api/export/report?runId=${run.id}&kind=pdf`} className="btn btn-secondary btn-sm">Export PDF</a>
                  <a href={`/api/export/report?runId=${run.id}&kind=pack`} className="btn btn-secondary btn-sm">Download accountant pack</a>
                </div>

                {warnings.length ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="font-semibold">Review warnings</div>
                    <ul className="mt-2 list-disc pl-5">
                      {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                  <form action={updateRun} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="runId" value={run.id} />
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      Status
                      <select name="status" defaultValue={run.status} className="rounded-lg border border-slate-300 px-3 py-2 font-normal">
                        <option value="DRAFT">Draft</option>
                        <option value="NEEDS_REVIEW">Needs review</option>
                        <option value="READY">Ready</option>
                        <option value="EXPORTED">Exported</option>
                      </select>
                    </label>
                    <SubmitButton variant="secondary">Update report</SubmitButton>
                  </form>
                  <form action={deleteRun} className="ml-auto">
                    <input type="hidden" name="runId" value={run.id} />
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Delete run
                    </button>
                  </form>
                </div>
              </div>
            );
          }) : <p className="text-sm text-slate-500">No reports generated yet for this filter.</p>}
        </div>
      </section>
    </div>
  );
}

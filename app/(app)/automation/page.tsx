import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildLandlordDigest } from "@/lib/digest";
import { sendEmailSafe } from "@/lib/email";
import SubmitButton from "@/components/SubmitButton";
import { buildMissingDocumentEmail, getUploadedApplicantDocs } from "@/lib/applicant-documents";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

function fmtDate(d?: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function AutomationPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const qs = (await searchParams) ?? {};
  const sent = typeof qs.sent === "string" ? qs.sent : "";
  const error = typeof qs.error === "string" ? decodeURIComponent(qs.error) : "";
  const successDetail = typeof qs.detail === "string" ? decodeURIComponent(qs.detail) : "";
  const config = (await prisma.reminderConfig.findFirst()) ?? (await prisma.reminderConfig.create({ data: {} }));
  const preview = await buildLandlordDigest(sessionUser.id, new Date());
  const emailLogs = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
  const applicants = await prisma.applicant.findMany({
    where: {
      userId: sessionUser.id,
      deletedAt: null,
      email: { not: null },
      status: { in: ["APPLIED", "REFERENCING", "MORE_INFO_REQUESTED"] },
    },
    include: { property: true, referencing: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const applicantsMissingDocs = (
    await Promise.all(applicants.map(async (applicant) => {
      const docs = await getUploadedApplicantDocs(applicant.id);
      const draft = buildMissingDocumentEmail({
        applicantName: applicant.fullName,
        propertyName: applicant.property?.name ?? null,
        uploadedDocs: docs,
        referencing: applicant.referencing,
        hasPets: applicant.hasPets,
      });
      return {
        id: applicant.id,
        name: applicant.fullName,
        email: applicant.email!,
        propertyName: applicant.property?.name ?? "Unassigned",
        count: draft.missingItems.length,
      };
    }))
  ).filter((row) => row.count > 0);

  async function saveConfig(formData: FormData) {
    "use server";

    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const enabled = formData.get("enabled") === "on";
    const dailyEnabled = formData.get("dailyEnabled") === "on";
    const weeklyEnabled = formData.get("weeklyEnabled") === "on";
    const dailyTimeUtc = String(formData.get("dailyTimeUtc") ?? "08:00") || "08:00";
    const weeklyTimeUtc = String(formData.get("weeklyTimeUtc") ?? "08:00") || "08:00";
    const weeklyDay = Math.min(7, Math.max(1, Number(formData.get("weeklyDay") ?? 1) || 1));

    await prisma.reminderConfig.upsert({
      where: { id: config.id },
      create: { enabled, dailyEnabled, weeklyEnabled, dailyTimeUtc, weeklyTimeUtc, weeklyDay },
      update: { enabled, dailyEnabled, weeklyEnabled, dailyTimeUtc, weeklyTimeUtc, weeklyDay },
    });

    redirect("/automation?sent=config");
  }

  async function sendDigestNow(formData: FormData) {
    "use server";

    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const digestType = String(formData.get("digestType") ?? "daily");
    const to = process.env.EMAIL_TO;
    if (!to) {
      redirect(`/automation?error=${encodeURIComponent("Email could not be sent because EMAIL_TO is not set in your .env file.")}`);
    }

    const digest = await buildLandlordDigest(sessionUser.id, new Date());
    const result = await sendEmailSafe({
      to,
      subject: `Landlord Portfolio — ${digestType === "weekly" ? "Weekly" : "Daily"} digest`,
      html: digest.html,
      text: digest.text,
    });

    if (!result.ok) redirect(`/automation?error=${encodeURIComponent(result.error)}`);
    redirect(`/automation?sent=${digestType}`);
  }

  async function sendMissingDocReminders() {
    "use server";

    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const records = await prisma.applicant.findMany({
      where: {
        userId: sessionUser.id,
        deletedAt: null,
        email: { not: null },
        status: { in: ["APPLIED", "REFERENCING", "MORE_INFO_REQUESTED"] },
      },
      include: { property: true, referencing: true },
    });

    let sentCount = 0;
    let failedCount = 0;
    let firstError = "";

    for (const applicant of records) {
      const uploadedDocs = await getUploadedApplicantDocs(applicant.id);
      const draft = buildMissingDocumentEmail({
        applicantName: applicant.fullName,
        propertyName: applicant.property?.name ?? null,
        uploadedDocs,
        referencing: applicant.referencing,
        hasPets: applicant.hasPets,
      });
      if (!draft.missingItems.length || !applicant.email) continue;

      const result = await sendEmailSafe({
        to: applicant.email,
        subject: draft.subject,
        text: draft.text,
        html: draft.html,
      });

      if (result.ok) sentCount += 1;
      else {
        failedCount += 1;
        if (!firstError) firstError = result.error;
      }
    }

    if (failedCount > 0 && sentCount === 0) {
      redirect(`/automation?error=${encodeURIComponent(firstError || "No reminder emails could be sent.")}`);
    }

    const detail = failedCount > 0 ? `${sentCount} sent, ${failedCount} failed.` : `${sentCount} reminder email${sentCount === 1 ? "" : "s"} sent.`;
    redirect(`/automation?sent=missing-docs&detail=${encodeURIComponent(detail)}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automation centre</h1>
          <p className="mt-1 text-sm text-slate-500">Control reminder schedules, preview the digest, and trigger email automations manually.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/settings" className="btn btn-secondary btn-sm">Open settings</Link>
          <a href="/api/export/actions" className="btn btn-secondary btn-sm">Export actions</a>
        </div>
      </div>

      {error && (
        <div className="banner banner-danger">{error}</div>
      )}

      {sent && (
        <div className="banner banner-success">
          {sent === "config" ? "Automation settings saved." : sent === "missing-docs" ? (successDetail || "Missing-document reminder emails processed.") : `${sent[0].toUpperCase()}${sent.slice(1)} digest sent.`}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <section className="section-card section-card-muted">
          <div>
            <h2 className="section-title">Reminder schedule</h2>
            <p className="section-subtitle">These values are stored in the app and used by the cron endpoints.</p>
          </div>
          <form action={saveConfig} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 md:col-span-2">
              <span className="flex items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={config.enabled} className="h-4 w-4" /> Master automation enabled</span>
            </label>
            <label className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-3"><input type="checkbox" name="dailyEnabled" defaultChecked={config.dailyEnabled} className="h-4 w-4" /> Daily digest enabled</span>
              <span className="text-xs text-slate-500">UTC send time</span>
              <input type="time" name="dailyTimeUtc" defaultValue={config.dailyTimeUtc} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-3"><input type="checkbox" name="weeklyEnabled" defaultChecked={config.weeklyEnabled} className="h-4 w-4" /> Weekly digest enabled</span>
              <span className="text-xs text-slate-500">UTC send time</span>
              <input type="time" name="weeklyTimeUtc" defaultValue={config.weeklyTimeUtc} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Weekly send day
              <select name="weeklyDay" defaultValue={String(config.weeklyDay)} className="rounded-lg border border-slate-300 px-3 py-2 font-normal">
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
                <option value="7">Sunday</option>
              </select>
            </label>
            <div className="md:col-span-2">
              <SubmitButton>Save automation settings</SubmitButton>
            </div>
          </form>
        </section>

        <section className="section-card bg-gradient-to-br from-blue-50 to-sky-50">
          <div>
            <h2 className="section-title">Manual triggers</h2>
            <p className="section-subtitle">Useful while testing before wiring cron jobs on Vercel.</p>
          </div>
          <div className="mt-4 grid gap-3">
            <form action={sendDigestNow}>
              <input type="hidden" name="digestType" value="daily" />
              <SubmitButton className="w-full">Send daily digest now</SubmitButton>
            </form>
            <form action={sendDigestNow}>
              <input type="hidden" name="digestType" value="weekly" />
              <SubmitButton className="w-full" variant="secondary">Send weekly digest now</SubmitButton>
            </form>
            <form action={sendMissingDocReminders}>
              <SubmitButton className="w-full" variant="secondary">Send applicant document reminders</SubmitButton>
            </form>
          </div>
          <div className="mt-4 rounded-xl border border-blue-200 bg-white/80 p-4 text-sm text-slate-600">
            <div><strong>Daily cron:</strong> <code>/api/cron/daily</code></div>
            <div className="mt-1"><strong>Weekly cron:</strong> <code>/api/cron/weekly</code></div>
            <div className="mt-2 text-xs">Protect both endpoints with <code>CRON_SECRET</code> and set <code>EMAIL_TO</code>, <code>EMAIL_FROM</code>, and <code>APP_BASE_URL</code> in your env.</div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,1fr]">
        <section className="section-card overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Digest preview</h2>
              <p className="section-subtitle">A live preview of the landlord digest email.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Today</span>
          </div>
          <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">{preview.text}</pre>
        </section>

        <div className="space-y-6">
          <section className="section-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title">Applicants missing documents</h2>
                <p className="section-subtitle">Applicants who will be targeted by the reminder email action.</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{applicantsMissingDocs.length} queued</span>
            </div>
            <div className="mt-4 space-y-3">
              {applicantsMissingDocs.length ? applicantsMissingDocs.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="font-semibold text-slate-900">{row.name}</div>
                  <div className="text-slate-500">{row.propertyName} · {row.email}</div>
                  <div className="mt-1 text-slate-700">{row.count} missing item{row.count === 1 ? "" : "s"}</div>
                </div>
              )) : <p className="text-sm text-slate-500">No applicants currently need a document reminder.</p>}
            </div>
          </section>

          <section className="section-card">
            <h2 className="section-title">Recent email activity</h2>
            <div className="mt-4 space-y-3">
              {emailLogs.map((email) => (
                <div key={email.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{email.subject}</div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${email.status === "SENT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{email.status}</span>
                  </div>
                  <div className="mt-1 text-slate-500">{email.to}</div>
                  <div className="mt-1 text-xs text-slate-400">{fmtDate(email.createdAt)} {email.createdAt.toISOString().slice(11, 19)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
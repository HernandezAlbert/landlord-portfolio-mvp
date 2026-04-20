import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildLandlordDigest } from "@/lib/digest";
import { sendEmailSafe } from "@/lib/email";
import SubmitButton from "@/components/SubmitButton";
import {
  buildMissingDocumentEmail,
  getUploadedApplicantDocs,
} from "@/lib/applicant-documents";
import { redirect } from "next/navigation";
import { requireAdminSessionUser } from "@/lib/auth";

function fmtDate(d?: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function AutomationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await requireAdminSessionUser();
  const qs = (await searchParams) ?? {};
  const sent = typeof qs.sent === "string" ? qs.sent : "";
  const error = typeof qs.error === "string" ? decodeURIComponent(qs.error) : "";
  const successDetail =
    typeof qs.detail === "string" ? decodeURIComponent(qs.detail) : "";

  const config =
    (await prisma.reminderConfig.findFirst()) ??
    (await prisma.reminderConfig.create({ data: {} }));

  const preview = await buildLandlordDigest(sessionUser.id, new Date());

  const emailLogs = await prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const applicants = await prisma.applicant.findMany({
    where: {
      userId: sessionUser.id,
      deletedAt: null,
      email: { not: null },
      status: { in: ["APPLIED", "REFERENCING", "MORE_INFO_REQUESTED"] },
    },
    include: {
      property: true,
      referencing: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const applicantsMissingDocs = (
    await Promise.all(
      applicants.map(async (applicant) => {
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
      })
    )
  ).filter((row) => row.count > 0);

  async function saveConfig(formData: FormData) {
    "use server";

    await requireAdminSessionUser();

    const enabled = formData.get("enabled") === "on";
    const dailyEnabled = formData.get("dailyEnabled") === "on";
    const weeklyEnabled = formData.get("weeklyEnabled") === "on";
    const dailyTimeUtc =
      String(formData.get("dailyTimeUtc") ?? "08:00") || "08:00";
    const weeklyTimeUtc =
      String(formData.get("weeklyTimeUtc") ?? "08:00") || "08:00";
    const weeklyDay = Math.min(
      7,
      Math.max(1, Number(formData.get("weeklyDay") ?? 1) || 1)
    );

    await prisma.reminderConfig.upsert({
      where: { id: config.id },
      create: {
        enabled,
        dailyEnabled,
        weeklyEnabled,
        dailyTimeUtc,
        weeklyTimeUtc,
        weeklyDay,
      },
      update: {
        enabled,
        dailyEnabled,
        weeklyEnabled,
        dailyTimeUtc,
        weeklyTimeUtc,
        weeklyDay,
      },
    });

    redirect("/automation?sent=config");
  }

  async function sendDigestNow(formData: FormData) {
    "use server";

    const sessionUser = await requireAdminSessionUser();
    const digestType = String(formData.get("digestType") ?? "daily");
    const to = process.env.EMAIL_TO;

    if (!to) {
      redirect(
        `/automation?error=${encodeURIComponent(
          "Email could not be sent because EMAIL_TO is not set in your .env file."
        )}`
      );
    }

    const digest = await buildLandlordDigest(sessionUser.id, new Date());
    const result = await sendEmailSafe({
      to,
      subject: `Landlord Portfolio — ${
        digestType === "weekly" ? "Weekly" : "Daily"
      } digest`,
      html: digest.html,
      text: digest.text,
    });

    if (!result.ok) {
      redirect(`/automation?error=${encodeURIComponent(result.error)}`);
    }

    redirect(`/automation?sent=${digestType}`);
  }

  async function sendMissingDocReminders() {
    "use server";

    const sessionUser = await requireAdminSessionUser();

    const records = await prisma.applicant.findMany({
      where: {
        userId: sessionUser.id,
        deletedAt: null,
        email: { not: null },
        status: { in: ["APPLIED", "REFERENCING", "MORE_INFO_REQUESTED"] },
      },
      include: {
        property: true,
        referencing: true,
      },
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

      if (result.ok) {
        sentCount += 1;
      } else {
        failedCount += 1;
        if (!firstError) firstError = result.error;
      }
    }

    if (failedCount > 0 && sentCount === 0) {
      redirect(
        `/automation?error=${encodeURIComponent(
          firstError || "No reminder emails could be sent."
        )}`
      );
    }

    const detail =
      failedCount > 0
        ? `${sentCount} sent, ${failedCount} failed.`
        : `${sentCount} reminder email${
            sentCount === 1 ? "" : "s"
          } sent.`;

    redirect(`/automation?sent=missing-docs&detail=${encodeURIComponent(detail)}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Automation centre
          </h1>
          <p className="mt-2 text-slate-500">
            Admin-only controls for reminder schedules, digest preview, and
            manual automation triggers.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="btn btn-secondary btn-sm">
            Back to dashboard
          </Link>
          <Link href="/admin/support" className="btn btn-secondary btn-sm">
            Admin support
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {sent ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {sent === "config"
            ? "Automation settings saved."
            : sent === "missing-docs"
            ? successDetail || "Missing-document reminder emails processed."
            : `${sent[0].toUpperCase()}${sent.slice(1)} digest sent.`}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">
          Reminder schedule
        </h2>
        <p className="mt-2 text-slate-500">
          These values are stored globally in the app and used by the cron
          endpoints.
        </p>

        <form action={saveConfig} className="mt-6 space-y-6">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={config.enabled}
              className="h-5 w-5"
            />
            <span className="text-lg font-medium text-slate-700">
              Master automation enabled
            </span>
          </label>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-6">
              <label className="flex items-center gap-3">
                <input
                  name="dailyEnabled"
                  type="checkbox"
                  defaultChecked={config.dailyEnabled}
                  className="h-5 w-5"
                />
                <span className="text-xl font-medium text-slate-700">
                  Daily digest enabled
                </span>
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-slate-500">
                  UTC send time
                </span>
                <input
                  type="time"
                  name="dailyTimeUtc"
                  defaultValue={config.dailyTimeUtc}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6">
              <label className="flex items-center gap-3">
                <input
                  name="weeklyEnabled"
                  type="checkbox"
                  defaultChecked={config.weeklyEnabled}
                  className="h-5 w-5"
                />
                <span className="text-xl font-medium text-slate-700">
                  Weekly digest enabled
                </span>
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-slate-500">
                  UTC send time
                </span>
                <input
                  type="time"
                  name="weeklyTimeUtc"
                  defaultValue={config.weeklyTimeUtc}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
                />
              </label>
            </div>
          </div>

          <label className="block max-w-md">
            <span className="mb-2 block text-lg font-medium text-slate-700">
              Weekly send day
            </span>
            <select
              name="weeklyDay"
              defaultValue={String(config.weeklyDay)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
            >
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
              <option value="7">Sunday</option>
            </select>
          </label>

          <SubmitButton className="btn btn-primary">
            Save automation settings
          </SubmitButton>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Digest preview
            </h2>
            <p className="mt-2 text-slate-500">
              A live preview of the landlord digest email.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
            Today
          </div>
        </div>

        <pre className="mt-6 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          {preview.text}
        </pre>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Manual triggers</h2>
        <p className="mt-2 text-slate-500">
          Useful while testing before wiring cron jobs on Vercel.
        </p>

        <div className="mt-6 space-y-4">
          <form action={sendDigestNow}>
            <input type="hidden" name="digestType" value="daily" />
            <SubmitButton className="btn btn-primary w-full">
              Send daily digest now
            </SubmitButton>
          </form>

          <form action={sendDigestNow}>
            <input type="hidden" name="digestType" value="weekly" />
            <SubmitButton className="btn btn-secondary w-full">
              Send weekly digest now
            </SubmitButton>
          </form>

          <form action={sendMissingDocReminders}>
            <SubmitButton className="btn btn-secondary w-full">
              Send applicant document reminders
            </SubmitButton>
          </form>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
          <p>
            <strong>Daily cron:</strong> <code>/api/cron/daily</code>
          </p>
          <p className="mt-2">
            <strong>Weekly cron:</strong> <code>/api/cron/weekly</code>
          </p>
          <p className="mt-4">
            Protect both endpoints with <code>CRON_SECRET</code> and set{" "}
            <code>EMAIL_TO</code>, <code>EMAIL_FROM</code>, and{" "}
            <code>APP_BASE_URL</code> in your env.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Applicants missing documents
            </h2>
            <p className="mt-2 text-slate-500">
              Applicants who will be targeted by the reminder email action for
              the current admin user.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
            {applicantsMissingDocs.length} queued
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {applicantsMissingDocs.length ? (
            applicantsMissingDocs.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"
              >
                <div>
                  <div className="font-medium text-slate-900">{row.name}</div>
                  <div className="text-sm text-slate-500">
                    {row.propertyName} · {row.email}
                  </div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  {row.count} missing item{row.count === 1 ? "" : "s"}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No applicants currently need a document reminder.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">
          Recent email activity
        </h2>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="pb-3 pr-4 font-medium">Created</th>
                <th className="pb-3 pr-4 font-medium">Subject</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">To</th>
              </tr>
            </thead>
            <tbody>
              {emailLogs.map((email) => (
                <tr key={email.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 text-slate-600">
                    {fmtDate(email.createdAt)}{" "}
                    {email.createdAt.toISOString().slice(11, 19)}
                  </td>
                  <td className="py-3 pr-4 text-slate-900">{email.subject}</td>
                  <td className="py-3 pr-4 text-slate-600">{email.status}</td>
                  <td className="py-3 pr-4 text-slate-600">{email.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
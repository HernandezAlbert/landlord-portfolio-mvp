import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureScheduledReports, getCurrentTaxYearStart, getQuarterPeriods, getAnnualPeriod, diffInDays, getReminderDays } from "@/lib/reporting";
import { sendEmailSafe } from "@/lib/email";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const created = await ensureScheduledReports(today);

  const schedules = await prisma.reportSchedule.findMany({ where: { isActive: true, reminderEnabled: true }, include: { property: true } });
  let remindersSent = 0;

  for (const schedule of schedules) {
    const periods = schedule.type === "ANNUAL"
      ? [getAnnualPeriod(getCurrentTaxYearStart(today)), getAnnualPeriod(getCurrentTaxYearStart(today) - 1)]
      : [...getQuarterPeriods(getCurrentTaxYearStart(today)), ...getQuarterPeriods(getCurrentTaxYearStart(today) - 1)];

    for (const period of periods) {
      const daysUntilDue = diffInDays(period.dueDate, today);
      if (!getReminderDays(schedule.reminderDays).includes(daysUntilDue)) continue;

      const existingRun = await prisma.reportRun.findFirst({
        where: {
          type: schedule.type,
          propertyId: schedule.propertyId,
          periodStart: period.start,
          periodEnd: period.end,
        },
        orderBy: { generatedAt: "desc" },
      });

      const to = process.env.EMAIL_TO;
      if (!to) continue;

      const scope = schedule.property?.name || "All properties";
      const subject = `Landlord Portfolio — ${period.title} due ${period.dueDate.toISOString().slice(0, 10)}`;
      const body = [
        `${period.title} is due in ${daysUntilDue} day(s).`,
        `Scope: ${scope}`,
        existingRun ? "Draft already generated." : "No draft exists yet.",
      ].join("\n");

      const result = await sendEmailSafe({ to, subject, text: body, html: `<p>${body.replace(/\n/g, "<br />")}</p>` });
      if (result.ok) remindersSent += 1;
    }
  }

  return NextResponse.json({ ok: true, createdReports: created.length, created, remindersSent });
}

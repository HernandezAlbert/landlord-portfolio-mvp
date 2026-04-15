import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { buildLandlordDigest } from "@/lib/digest";
import { prisma } from "@/lib/prisma";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.reminderConfig.findFirst();
  if (config && (!config.enabled || !config.weeklyEnabled)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Weekly disabled" });
  }

  const users = await prisma.user.findMany({
    include: { settings: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const userSettings = user.settings;

    if (userSettings && userSettings.digestEnabled === false) {
      skipped++;
      continue;
    }

    const to = userSettings?.digestEmailTo || user.email;
    if (!to) {
      skipped++;
      continue;
    }

    try {
      const digest = await buildLandlordDigest(user.id, new Date());

      await sendEmail({
        to,
        subject: "Landlord Portfolio — Weekly digest",
        html: digest.html,
        text: digest.text,
      });

      sent++;
    } catch (err) {
      console.error("Weekly digest failed for user", user.id, err);
    }
  }

  return NextResponse.json({
    ok: true,
    usersProcessed: users.length,
    sent,
    skipped,
  });
}
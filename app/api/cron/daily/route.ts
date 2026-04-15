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

  const to = process.env.EMAIL_TO;
  if (!to) {
    return NextResponse.json({ error: "EMAIL_TO missing" }, { status: 500 });
  }

  const config = await prisma.reminderConfig.findFirst();
  if (config && (!config.enabled || !config.dailyEnabled)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Daily reminders disabled" });
  }

  const owner = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!owner) {
    return NextResponse.json({ ok: true, skipped: true, reason: "No users found" });
  }

  const digest = await buildLandlordDigest(owner.id, new Date());

  await sendEmail({
    to,
    subject: "Landlord Portfolio — Daily digest",
    html: digest.html,
    text: digest.text,
  });

  return NextResponse.json({ ok: true });
}
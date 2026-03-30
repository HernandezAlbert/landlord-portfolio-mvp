import { NextResponse } from "next/server";
import { syncApplicantsForEligibleProperties } from "@/lib/google-form-sync";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await syncApplicantsForEligibleProperties({ sendEmails: true });
  return NextResponse.json({
    ok: true,
    checked: results.length,
    imported: results.reduce((sum, item) => sum + item.imported, 0),
    skipped: results.reduce((sum, item) => sum + item.skipped, 0),
    results,
  });
}

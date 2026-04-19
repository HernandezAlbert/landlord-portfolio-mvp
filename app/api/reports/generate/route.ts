import { NextResponse } from "next/server";
import { ReportType } from "@prisma/client";
import { createReportRun } from "@/lib/reporting";
import { requireSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const sessionUser = await requireSessionUser();
    const { type, year, propertyId, quarter } = await req.json();

    const reportType = String(type || "ANNUAL") as ReportType;
    const yearStart = Number(year);

    if (!Number.isFinite(yearStart)) {
      return new NextResponse("Invalid tax year.", { status: 400 });
    }

    const quarterValue =
      reportType === "QUARTERLY" ? Number(quarter || 1) : null;

    await createReportRun({
      userId: sessionUser.id,
      type: reportType,
      yearStart,
      quarter: quarterValue,
      propertyId: propertyId || null,
      generatedBy: "manual",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Generate report failed:", error);
    return new NextResponse("Failed to generate report.", { status: 500 });
  }
}
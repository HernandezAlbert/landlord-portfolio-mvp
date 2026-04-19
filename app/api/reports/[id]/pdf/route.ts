import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";

export async function GET() {
  await requireSessionUser();

  return new NextResponse("PDF export not implemented yet", {
    status: 501,
  });
}
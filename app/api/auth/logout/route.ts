import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export async function POST() {
  await signOut();

  return NextResponse.redirect(new URL("/login", process.env.APP_BASE_URL || "http://localhost:3000"));
}
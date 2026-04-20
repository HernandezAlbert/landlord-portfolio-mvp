import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export async function POST(request: Request) {
  await signOut();

  const loginUrl = new URL("/login", request.url);

  return NextResponse.redirect(loginUrl, 303);
}
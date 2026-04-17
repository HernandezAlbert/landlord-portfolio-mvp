import { NextResponse } from "next/server";

import { resetPasswordWithToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));

  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Token and password are required" },
      { status: 400 }
    );
  }

  const result = await resetPasswordWithToken(token, password);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
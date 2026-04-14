import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const res = await signIn(String(email), String(password));

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
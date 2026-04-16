import { NextResponse } from "next/server";
import { createUserAndSignIn } from "@/lib/auth";

type SignupBody = {
  email?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as SignupBody;

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!email || !password || !confirmPassword) {
    return NextResponse.json(
      { error: "Email, password, and confirmation are required" },
      { status: 400 }
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { error: "Passwords do not match" },
      { status: 400 }
    );
  }

  const result = await createUserAndSignIn(email, password);

  if (!result.ok) {
    const status =
      result.error === "An account with this email already exists" ? 409 : 400;

    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
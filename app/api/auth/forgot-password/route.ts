import { NextResponse } from "next/server";

import { createPasswordReset } from "@/lib/auth";
import { sendEmailSafe } from "@/lib/email";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const result = await createPasswordReset(email, req.url);

  if (result.ok && result.userEmail && result.resetUrl) {
    const subject = "Reset your Landlord Portfolio password";
    const html = [
      "<p>You requested a password reset for your Landlord Portfolio account.</p>",
      `<p><a href="${result.resetUrl}">Click here to reset your password</a></p>`,
      "<p>If you did not request this, you can ignore this email.</p>",
      `<p>This link will expire at ${result.expiresAt.toISOString()}.</p>`,
    ].join("");

    const text = [
      "You requested a password reset for your Landlord Portfolio account.",
      "",
      `Reset your password: ${result.resetUrl}`,
      "",
      "If you did not request this, you can ignore this email.",
      `This link will expire at ${result.expiresAt.toISOString()}.`,
    ].join("\n");

    await sendEmailSafe({
      to: result.userEmail,
      subject,
      html,
      text,
    });
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email address, a password reset link has been sent.",
  });
}
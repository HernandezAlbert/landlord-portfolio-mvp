import { prisma } from "@/lib/prisma";

type SendEmailArgs = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export class EmailSendError extends Error {
  status?: number;
  body?: string;
  userMessage: string;

  constructor(message: string, options?: { status?: number; body?: string; userMessage?: string }) {
    super(message);
    this.name = "EmailSendError";
    this.status = options?.status;
    this.body = options?.body;
    this.userMessage = options?.userMessage ?? "Email could not be sent.";
  }
}

function friendlyResendMessage(status?: number, body?: string) {
  if (status === 401) return "Email could not be sent because the Resend API key is missing or invalid.";
  if (status === 403) return "Email could not be sent because the sender or recipient is not allowed by your current Resend setup. While using onboarding@resend.dev, send test emails only to the email address on your Resend account, or verify your own domain first.";
  if (status === 422) return "Email could not be sent because the email payload is invalid. Check the to/from addresses and subject.";
  if (status && status >= 500) return "Email service is temporarily unavailable. Please try again shortly.";
  if (body && body.length < 220) return `Email could not be sent. ${body}`;
  return "Email could not be sent. Please check your email settings and try again.";
}

export function getFriendlyEmailErrorMessage(error: unknown) {
  if (error instanceof EmailSendError) return error.userMessage;
  const msg = String((error as Error | undefined)?.message ?? error ?? "").trim();
  if (msg.includes("EMAIL_TO missing")) return "Email could not be sent because EMAIL_TO is not set in your .env file.";
  if (msg.includes("EMAIL_FROM missing")) return "Email could not be sent because EMAIL_FROM is not set in your .env file.";
  if (msg.includes("RESEND_API_KEY missing")) return "Email could not be sent because RESEND_API_KEY is not set in your .env file.";
  return msg || "Email could not be sent. Please check your email configuration.";
}

export async function sendEmail({ to, subject, html, text }: SendEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) {
    throw new EmailSendError("RESEND_API_KEY missing", {
      userMessage: "Email could not be sent because RESEND_API_KEY is not set in your .env file.",
    });
  }
  if (!from) {
    throw new EmailSendError("EMAIL_FROM missing", {
      userMessage: "Email could not be sent because EMAIL_FROM is not set in your .env file.",
    });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      await prisma.emailLog.create({
        data: {
          to,
          subject,
          html: html ?? null,
          text: text ?? null,
          status: "FAILED",
          error: `HTTP ${res.status}: ${body}`.slice(0, 5000),
        },
      });
      throw new EmailSendError(`Resend error: HTTP ${res.status}`, {
        status: res.status,
        body,
        userMessage: friendlyResendMessage(res.status, body),
      });
    }

    await prisma.emailLog.create({
      data: { to, subject, html: html ?? null, text: text ?? null, status: "SENT" },
    });

    return { ok: true as const };
  } catch (e: any) {
    await prisma.emailLog.create({
      data: {
        to,
        subject,
        html: html ?? null,
        text: text ?? null,
        status: "FAILED",
        error: String(e?.message ?? e).slice(0, 5000),
      },
    });
    throw e;
  }
}

export async function sendEmailSafe(args: SendEmailArgs) {
  try {
    await sendEmail(args);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: getFriendlyEmailErrorMessage(error) };
  }
}

export function formatMoney(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

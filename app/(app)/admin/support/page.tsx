import { getSessionUser, isAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

type SearchParams = Promise<{
  email?: string;
}>;

function normalizeEmail(value: string) {
  return value.toLowerCase().trim();
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getResetTokenStatus(resetToken: {
  expiresAt: Date;
  usedAt: Date | null;
} | null) {
  if (!resetToken) {
    return "No reset token found";
  }

  if (resetToken.usedAt) {
    return "Used";
  }

  if (resetToken.expiresAt.getTime() < Date.now()) {
    return "Expired";
  }

  return "Active";
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const currentUser = await getSessionUser();

  if (!currentUser) {
    redirect("/login");
  }

  const isAdmin =
    currentUser.role === "ADMIN" || isAdminEmail(currentUser.email);

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const emailQuery = params.email?.trim() ?? "";
  const normalizedEmail = emailQuery ? normalizeEmail(emailQuery) : "";

  const user = normalizedEmail
    ? await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          settings: {
            select: {
              digestEmailTo: true,
              replyToEmail: true,
              digestEnabled: true,
              timezone: true,
            },
          },
          _count: {
            select: {
              properties: true,
              tenants: true,
              applicants: true,
              passwordResetTokens: true,
              actionOverrides: true,
            },
          },
        },
      })
    : null;

  const latestResetToken = user
    ? await prisma.passwordResetToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          usedAt: true,
        },
      })
    : null;

  const emailLogs = normalizedEmail
    ? await prisma.emailLog.findMany({
        where: {
          to: {
            equals: normalizedEmail,
            mode: "insensitive",
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          to: true,
          subject: true,
          status: true,
          error: true,
          createdAt: true,
        },
      })
    : [];

  const recentResetEmailLogs = emailLogs.filter((log) =>
    log.subject.toLowerCase().includes("reset"),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Admin Support
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Look up a user by email and check account, reset-token, and email
              delivery status.
            </p>
          </div>

          <form method="get" className="flex w-full max-w-2xl gap-3">
            <input
              type="email"
              name="email"
              defaultValue={emailQuery}
              placeholder="user@example.com"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-0 transition focus:border-blue-500"
            />
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {!emailQuery ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
          Enter a user email above to inspect login-support details.
        </section>
      ) : !user ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
          No user found for <span className="font-semibold">{emailQuery}</span>.
        </section>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Account</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Email</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {user.email}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Role</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {user.role}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Created</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {formatDateTime(user.createdAt)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Updated</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {formatDateTime(user.updatedAt)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                User Settings / Counts
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Digest email to</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {user.settings?.digestEmailTo || "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Reply-to email</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {user.settings?.replyToEmail || "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Digest enabled</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {user.settings
                      ? user.settings.digestEnabled
                        ? "Yes"
                        : "No"
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Timezone</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {user.settings?.timezone || "—"}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Properties</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {user._count.properties}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Tenants</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {user._count.tenants}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Applicants</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {user._count.applicants}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Reset tokens</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {user._count.passwordResetTokens}
                    </div>
                  </div>
                </div>
              </dl>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Latest Password Reset Token
              </h2>

              {!latestResetToken ? (
                <p className="mt-4 text-sm text-slate-600">
                  No password reset token found for this user.
                </p>
              ) : (
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                    <dt className="text-slate-500">Status</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {getResetTokenStatus(latestResetToken)}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                    <dt className="text-slate-500">Created</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {formatDateTime(latestResetToken.createdAt)}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                    <dt className="text-slate-500">Expires</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {formatDateTime(latestResetToken.expiresAt)}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Used</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {formatDateTime(latestResetToken.usedAt)}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Reset Email Diagnostics
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">All email logs</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {emailLogs.length}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">
                    Reset-related logs
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {recentResetEmailLogs.length}
                  </div>
                </div>
              </div>

              {recentResetEmailLogs.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  No recent reset-related email logs found for this address.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentResetEmailLogs.slice(0, 3).map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {log.subject}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDateTime(log.createdAt)}
                          </div>
                        </div>
                        <div className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                          {log.status}
                        </div>
                      </div>
                      {log.error ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                          {log.error}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Email Logs
            </h2>

            {emailLogs.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                No email logs found for this user email.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-3 py-2 font-medium">Created</th>
                      <th className="px-3 py-2 font-medium">Subject</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-slate-100 align-top"
                      >
                        <td className="px-3 py-3 text-slate-700">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-900">
                          {log.subject}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {log.status}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {log.error || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
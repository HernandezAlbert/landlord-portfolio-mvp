import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdminEmail } from "@/lib/auth";
import { getDocumentStorageSettings } from "@/lib/document-storage";
import {
  deleteUserAdminAction,
  ensureMissingUserSettingsAdminAction,
  recalculateAllApplicantsAdminAction,
  recalculateMyApplicantsAction,
  saveDocumentStorageSettingsAdminAction,
  saveUserSettingsAction,
} from "./actions";

function decodeParam(value: string | null) {
  return value ? decodeURIComponent(value) : null;
}

function fmtDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const settings = await prisma.userSettings.upsert({
    where: { userId: sessionUser.id },
    update: {},
    create: {
      userId: sessionUser.id,
      digestEmailTo: sessionUser.email,
      replyToEmail: sessionUser.email,
    },
  });

  const isAdmin = isAdminEmail(sessionUser.email);

  const params = (await searchParams) ?? {};

  const saved =
    typeof params.saved === "string" ? decodeParam(params.saved) : null;
  const recalcMineRaw =
    typeof params.recalcMine === "string" ? params.recalcMine : null;
  const recalcAllRaw =
    typeof params.recalcAll === "string" ? params.recalcAll : null;
  const ensuredSettingsRaw =
    typeof params.ensuredSettings === "string" ? params.ensuredSettings : null;
  const deletedUser =
    typeof params.deletedUser === "string" ? decodeParam(params.deletedUser) : null;
  const adminError =
    typeof params.adminError === "string" ? decodeParam(params.adminError) : null;

  const recalcMine =
    recalcMineRaw !== null && !Number.isNaN(Number(recalcMineRaw))
      ? Number(recalcMineRaw)
      : null;

  const recalcAll =
    recalcAllRaw !== null && !Number.isNaN(Number(recalcAllRaw))
      ? Number(recalcAllRaw)
      : null;

  const ensuredSettings =
    ensuredSettingsRaw !== null && !Number.isNaN(Number(ensuredSettingsRaw))
      ? Number(ensuredSettingsRaw)
      : null;

  const adminUsers = isAdmin
    ? await prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          createdAt: true,
          settings: {
            select: {
              id: true,
              digestEnabled: true,
              digestEmailTo: true,
              replyToEmail: true,
              timezone: true,
            },
          },
          _count: {
            select: {
              properties: true,
              tenants: true,
              applicants: true,
            },
          },
        },
      })
    : [];
  const documentStorageSettings = isAdmin ? await getDocumentStorageSettings() : [];

  const totalUsers = adminUsers.length;
  const usersMissingSettings = adminUsers.filter((user) => !user.settings).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage your digest preferences, email defaults, and maintenance actions.
        </p>
      </div>

      {saved === "profile" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your settings were saved.
        </div>
      ) : null}

      {saved === "document-storage" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Document storage paths were saved.
        </div>
      ) : null}

      {recalcMine !== null ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Recalculation complete. Updated {recalcMine} of your applicant
          {recalcMine === 1 ? "" : "s"}.
        </div>
      ) : null}

      {recalcAll !== null ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Admin recalculation complete. Updated {recalcAll} applicant
          {recalcAll === 1 ? "" : "s"} across all users.
        </div>
      ) : null}

      {ensuredSettings !== null ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Admin maintenance complete. Created {ensuredSettings} missing settings
          record{ensuredSettings === 1 ? "" : "s"}.
        </div>
      ) : null}

      {deletedUser ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Deleted user: {deletedUser}
        </div>
      ) : null}

      {adminError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {adminError}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Your email settings</h2>
        <p className="mt-1 text-sm text-slate-600">
          These values control where your digest goes and the default email identity
          used by user-level automation.
        </p>

        <form action={saveUserSettingsAction} className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              htmlFor="digestEmailTo"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Digest email destination
            </label>
            <input
              id="digestEmailTo"
              name="digestEmailTo"
              type="email"
              defaultValue={settings.digestEmailTo ?? sessionUser.email}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="emailFromName"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              From name
            </label>
            <input
              id="emailFromName"
              name="emailFromName"
              type="text"
              defaultValue={settings.emailFromName ?? ""}
              placeholder="Landlord Portfolio"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="replyToEmail"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Reply-to email
            </label>
            <input
              id="replyToEmail"
              name="replyToEmail"
              type="email"
              defaultValue={settings.replyToEmail ?? sessionUser.email}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="timezone"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Timezone
            </label>
            <input
              id="timezone"
              name="timezone"
              type="text"
              defaultValue={settings.timezone}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-3 text-sm text-slate-700">
              <input
                name="digestEnabled"
                type="checkbox"
                defaultChecked={settings.digestEnabled}
                className="h-4 w-4 rounded border-slate-300"
              />
              Enable my digest emails
            </label>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Save settings
            </button>
          </div>
        </form>
      </section>

      {isAdmin ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Document storage</h2>
          <p className="mt-1 text-sm text-slate-600">
            Set server-side folders for uploaded documents. Leave a field blank to use its default path.
          </p>

          <form action={saveDocumentStorageSettingsAdminAction} className="mt-6 space-y-4">
            {documentStorageSettings.map((setting) => (
              <div key={setting.key}>
                <label
                  htmlFor={setting.key}
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  {setting.label}
                </label>
                <input
                  id={setting.key}
                  name={setting.key}
                  type="text"
                  defaultValue={setting.value}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
                <div className="mt-1 text-xs text-slate-500">
                  Default: <span className="font-mono">{setting.defaultValue}</span>
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Save document storage
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Applicant maintenance
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Recalculate screening, referencing scores, decisions, and applicant status
          using the latest rules.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <form action={recalculateMyApplicantsAction}>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Recalculate my applicants
            </button>
          </form>

          {isAdmin ? (
            <form action={recalculateAllApplicantsAdminAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Recalculate all applicants (admin)
              </button>
            </form>
          ) : null}
        </div>
      </section>

      {isAdmin ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Admin</h2>
              <p className="mt-1 text-sm text-slate-600">
                Temporary admin tools. Access is currently based on the
                <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs">
                  ADMIN_EMAIL
                </code>
                environment variable.
              </p>
            </div>

            <form action={ensureMissingUserSettingsAdminAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Ensure missing user settings
              </button>
            </form>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Total users</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {totalUsers}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Users missing settings</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {usersMissingSettings}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Admin account</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {sessionUser.email}
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    User
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Settings
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Portfolio
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Digest
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((user) => {
                  const isRowAdmin = isAdminEmail(user.email);

                  return (
                    <tr key={user.id}>
                      <td className="border-b border-slate-100 px-3 py-3 align-top text-sm text-slate-900">
                        <div className="font-medium">{user.email}</div>
                        {isRowAdmin ? (
                          <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            admin
                          </div>
                        ) : null}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 align-top text-sm text-slate-600">
                        {fmtDate(user.createdAt)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 align-top text-sm text-slate-600">
                        {user.settings ? "Present" : "Missing"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 align-top text-sm text-slate-600">
                        {user._count.properties} properties · {user._count.tenants} tenants ·{" "}
                        {user._count.applicants} applicants
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 align-top text-sm text-slate-600">
                        {user.settings ? (
                          <div className="space-y-1">
                            <div>
                              {user.settings.digestEnabled ? "Enabled" : "Disabled"}
                            </div>
                            <div>{user.settings.digestEmailTo ?? "—"}</div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 align-top text-sm text-slate-600">
                        {isRowAdmin ? (
                          <span className="text-slate-400">Protected</span>
                        ) : (
                          <form action={deleteUserAdminAction}>
                            <input type="hidden" name="userId" value={user.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                            >
                              Delete user
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

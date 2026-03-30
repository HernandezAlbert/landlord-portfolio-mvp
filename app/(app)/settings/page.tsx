import { recalculateAllApplicantsAction } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const recalcParam = typeof params.recalc === "string" ? params.recalc : null;
  const recalcCount =
    recalcParam !== null && !Number.isNaN(Number(recalcParam))
      ? Number(recalcParam)
      : null;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage application behaviour and maintenance actions.
        </p>
      </div>

      {/* SUCCESS MESSAGE */}
      {recalcCount !== null ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 shadow-sm">
          Recalculation complete. Updated {recalcCount} applicant
          {recalcCount === 1 ? "" : "s"}.
        </div>
      ) : null}

      {/* DOCUMENT STORAGE SETTINGS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Document storage
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Configure where uploaded documents are stored and retrieved from.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input
            placeholder="Expenses folder path"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Vetting / referencing folder"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Applications folder"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Contracts folder"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <button className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
          Save document settings
        </button>
      </div>

      {/* GOOGLE FORM / IMPORT SETTINGS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Applicant import (Google Forms)
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Automatically import applicants from Google Form responses for
          properties without active tenancies.
        </p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-slate-700">
            Enable automatic import
          </span>
          <input type="checkbox" className="h-5 w-5" />
        </div>

        <input
          placeholder="Google Sheet / CSV URL"
          className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />

        <button className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
          Save import settings
        </button>
      </div>

      {/* RE-CALCULATION */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Applicant recalculation
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Recalculate screening, referencing scores, decisions, and applicant
          status for all applicants using the latest rules.
        </p>

        <form action={recalculateAllApplicantsAction} className="mt-4">
          <button
            type="submit"
            className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Recalculate all applicants
          </button>
        </form>
      </div>
    </div>
  );
}
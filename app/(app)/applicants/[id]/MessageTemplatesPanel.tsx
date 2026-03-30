"use client";

import { useMemo, useState } from "react";
import type { ApplicantMessageDraft } from "@/lib/applicant-messaging";

type Props = {
  drafts: ApplicantMessageDraft[];
  disabled?: boolean;
  applicantId: string;
};

export default function MessageTemplatesPanel({ drafts, disabled = false, applicantId }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const activeDraft = useMemo(() => drafts.find((draft) => draft.key === activeKey) ?? null, [drafts, activeKey]);

  function openDraft(key: string) {
    const draft = drafts.find((item) => item.key === key);
    if (!draft) return;
    setActiveKey(key);
    setSubject(draft.subject);
    setBody(draft.text);
  }

  function closeModal() {
    setActiveKey(null);
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {drafts.map((draft) => (
          <div key={draft.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{draft.label}</div>
                <div className="mt-1 text-xs text-slate-500">{draft.subject}</div>
              </div>
              <button
                type="button"
                onClick={() => openDraft(draft.key)}
                disabled={disabled}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Preview & send
              </button>
            </div>
            <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-slate-500">Preview</summary>
              <textarea readOnly rows={7} value={draft.text} className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" />
            </details>
          </div>
        ))}
      </div>

      {activeDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Preview email</h3>
                <p className="mt-1 text-sm text-slate-500">Review and edit before sending.</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>

            <form
              method="post"
              action={`/applicants/${applicantId}/send-message`}
              className="mt-4 space-y-4"
            >
              <input type="hidden" name="template" value={activeDraft.key} />
              <label className="grid gap-1 text-sm">
                Subject
                <input
                  name="subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="rounded-lg border px-3 py-2"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm">
                Message
                <textarea
                  name="body"
                  rows={12}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="rounded-lg border px-3 py-2"
                  required
                />
              </label>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button type="button" onClick={closeModal} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Send email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

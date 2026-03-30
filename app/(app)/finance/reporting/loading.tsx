export default function LoadingReporting() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-80 rounded-xl bg-slate-200" />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="section-card space-y-4">
          <div className="h-6 w-52 rounded bg-slate-200" />
          <div className="h-4 w-80 rounded bg-slate-100" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="h-5 w-40 rounded bg-slate-200" />
              <div className="h-4 w-56 rounded bg-slate-100" />
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 rounded-xl bg-slate-200" />)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="h-5 w-36 rounded bg-slate-200" />
              <div className="h-4 w-52 rounded bg-slate-100" />
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 rounded-xl bg-slate-200" />)}
              </div>
            </div>
          </div>
        </div>
        <div className="section-card space-y-3">
          <div className="h-6 w-44 rounded bg-slate-200" />
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100" />)}
        </div>
      </div>
      <div className="section-card space-y-3">
        <div className="h-6 w-48 rounded bg-slate-200" />
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 rounded-2xl bg-slate-100" />)}
      </div>
    </div>
  );
}

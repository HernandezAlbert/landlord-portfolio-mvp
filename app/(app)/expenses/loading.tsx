export default function LoadingExpenses() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-40 rounded-xl bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-20 rounded-2xl bg-slate-100" />
        <div className="h-20 rounded-2xl bg-slate-100" />
      </div>
      <div className="section-card space-y-3">
        <div className="h-6 w-32 rounded bg-slate-200" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-10 rounded bg-slate-100" />
          <div className="h-10 rounded bg-slate-100" />
          <div className="h-10 rounded bg-slate-100" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-10 rounded bg-slate-100" />
          <div className="h-10 rounded bg-slate-100" />
          <div className="h-10 rounded bg-slate-100" />
        </div>
        <div className="h-10 rounded bg-slate-100" />
      </div>
      <div className="section-card space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100" />)}
      </div>
    </div>
  );
}

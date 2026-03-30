import Link from "next/link";

export default function StatCard({
  title,
  value,
  colour,
  href,
}: {
  title: string;
  value: string | number;
  colour: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className={`text-2xl font-semibold ${colour}`}>{value}</p>
        </div>
        {href && <span className="btn btn-secondary btn-sm">Open</span>}
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block">{body}</Link>;

  return body;
}

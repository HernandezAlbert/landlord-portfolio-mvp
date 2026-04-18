"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const baseItems = [
  ["/dashboard", "Dashboard"],
  ["/properties", "Properties"],
  ["/tenancies", "Tenancies"],
  ["/tenants", "Tenants"],
  ["/applicants", "Applicants"],
  ["/holding-deposits", "Holding Deposits"],
  ["/expenses", "Expenses"],
  ["/finance", "Finance"],
  ["/finance/reporting", "Reporting"],
  ["/actions", "Weekly Actions"],
  ["/automation", "Automation"],
  ["/notices", "Notices"],
  ["/settings", "Settings"],
] as const;

const adminItems = [["/admin/support", "Admin Support"]] as const;

type AppSidebarProps = {
  email: string;
  role: "USER" | "ADMIN";
};

export default function AppSidebar({ email, role }: AppSidebarProps) {
  const pathname = usePathname();
  const items = role === "ADMIN" ? [...baseItems, ...adminItems] : baseItems;

  return (
    <aside className="border-r border-slate-200 bg-slate-950 text-slate-100">
      <div className="sticky top-0 flex min-h-screen flex-col p-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-slate-950/30">
          <div className="text-lg font-black tracking-tight">
            Landlord Portfolio
          </div>
          <div className="mt-1 text-xs text-slate-400">{email}</div>
          <div className="mt-2 inline-flex rounded-full border border-slate-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
            {role}
          </div>
        </div>

        <nav className="mt-4 grid gap-2">
          {items.map(([href, label]) => {
            const active =
              href === "/finance"
                ? pathname === href
                : pathname === href ||
                  (href !== "/dashboard" && pathname.startsWith(`${href}/`));

            return (
              <Link
                key={href}
                href={href}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <form action="/api/auth/logout" method="post" className="mt-auto pt-6">
          <button
            type="submit"
            className="btn btn-secondary w-full border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          >
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
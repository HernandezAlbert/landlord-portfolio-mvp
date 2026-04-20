import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/AppSidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="grid h-full grid-cols-[260px_1fr]">
        <div className="min-h-0">
          <AppSidebar email={user.email} role={user.role} />
        </div>

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
            <div className="mx-auto max-w-7xl text-sm text-slate-600">
              Landlord Portfolio
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
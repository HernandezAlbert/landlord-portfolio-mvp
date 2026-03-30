import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/AppSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <AppSidebar email={user.email} />
        <main className="min-w-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 px-6 py-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

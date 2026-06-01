import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import getDashboardStatus from "@/lib/onboarding/getDashboardStatus";export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  // 🔥 USER
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // 🔴 NU e logat
  if (!user || error) {
    redirect("/login");
  }

  // 🔥 STATUS DASHBOARD (IMPORTANT: cu user.id)
  const status = await getDashboardStatus(user.id);

  // 🔴 NU a terminat onboarding
  if (!status.completed) {
    redirect("/admin/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-[#0B0B0C] text-white">

      {/* DESKTOP SIDEBAR */}
      <Sidebar />

      {/* CONTENT */}
      <main className="flex-1 p-6 md:p-10 pb-20 md:pb-10 bg-[#0F0F10]">
        {children}
      </main>

      {/* MOBILE NAV */}
      <MobileNav />
    </div>
  );
}
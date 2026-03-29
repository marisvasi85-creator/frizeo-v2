import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
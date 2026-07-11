import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { noIndexMetadata } from "@/lib/site/pageMetadata";

export const metadata = noIndexMetadata;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const role = await getCurrentRole();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) {
    redirect("/login");
  }

  return (
  <div className="flex min-h-screen bg-[#0B0B0C] text-white">

    <Sidebar role={role} />

    <main className="flex-1 p-6 md:p-10 pb-20 md:pb-10 bg-[#0F0F10]">
      {children}
    </main>

    <MobileNav role={role} />
    <InstallAppPrompt variant="admin" />

  </div>
);}
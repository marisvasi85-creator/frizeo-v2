import { redirect } from "next/navigation";
import { getActiveTenant } from "@/lib/supabase/getActiveTenant";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getActiveTenant();

  if (!tenant) {
    redirect("/select-tenant");
  }

  return <>{children}</>;
}

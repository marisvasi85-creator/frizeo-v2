import { redirect } from "next/navigation";
import { getActiveTenant } from "@/lib/supabase/getActiveTenant";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getActiveTenant();

  if (!tenant) {
    redirect("/select-tenant");
  }

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  return <>{children}</>;
}

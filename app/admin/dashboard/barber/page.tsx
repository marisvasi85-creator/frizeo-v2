// app/admin/dashboard/barber/page.tsx

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import MyServicesClient from "./MyServicesClient";

export default async function BarberServicesPage() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  const { data: services } = await supabase
    .from("services")
    .select(`
      id,
      name,
      duration_minutes,
      price,
      barber_services (
        id,
        display_name,
        duration,
        price,
        active
      )
    `)
    .eq("tenant_id", barber.tenant_id)
    .order("sort_order");

  return (
    <MyServicesClient
      barberId={barber.id}
      services={services ?? []}
    />
  );
}

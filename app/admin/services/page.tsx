import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";
import ServicesClient from "./ServicesClient";

export default async function ServicesPage() {
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) redirect("/login");

  const { data: services, error } = await supabase
    .from("barber_services")
    .select(`
      id,
      display_name,
      name,
      price,
      duration,
      active,
      sort_order
    `)
    .eq("barber_id", barber.id)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("SERVICES LOAD ERROR:", error);
  }

  return (
    <ServicesClient
      services={services ?? []}
      barberId={barber.id}
    />
  );
}
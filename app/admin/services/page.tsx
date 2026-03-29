import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";
import ServicesClient from "./ServicesClient";

export default async function ServicesPage() {
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) redirect("/login");

  const { data: services } = await supabase
    .from("barber_services")
    .select("*")
    .eq("barber_id", barber.id)
    .order("sort_order", { ascending: true });

  return (
    <div>
      <ServicesClient services={services ?? []} />
    </div>
  );
}
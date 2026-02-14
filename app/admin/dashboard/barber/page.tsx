// app/admin/dashboard/barber/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import MyServicesClient from "./MyServicesClient";

export default async function BarberServicesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p>Neautorizat</p>;
  }

  const { data: barber } = await supabase
    .from("barbers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!barber) {
    return <p>Nu ești asociat unui frizer.</p>;
  }

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
    .order("sort_order");

  return (
    <MyServicesClient
      barberId={barber.id}
      services={services ?? []}
    />
  );
}

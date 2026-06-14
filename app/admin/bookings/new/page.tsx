import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import AddBookingClient from "./AddBookingClient";

export default async function Page() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: barber } = await supabase
    .from("barbers")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!barber) {
    redirect("/admin");
  }

  const { data: services } = await supabase
    .from("barber_services")
    .select("*")
    .eq("barber_id", barber.id)
    .eq("active", true)
    .order("sort_order", {
      ascending: true,
    });

  const role = await getCurrentRole();

  let barbers: any[] = [];

  if (role === "owner") {
    const { data } = await supabase
      .from("barbers")
      .select(`
        id,
        display_name,
        active
      `)
      .eq("tenant_id", barber.tenant_id)
      .eq("active", true)
      .order("display_name");

    barbers = data || [];
  }

  return (
    <AddBookingClient
  barberId={barber.id}
  initialServices={services || []}
  role={role}
  barbers={barbers}
/>
  );
}
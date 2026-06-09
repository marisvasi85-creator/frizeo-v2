import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    .select("id")
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
    .order("sort_order", { ascending: true });

  return (
    <AddBookingClient
      barberId={barber.id}
      services={services || []}
    />
  );
}
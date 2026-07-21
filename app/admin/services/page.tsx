import { getAdminSession } from "@/lib/auth/getAdminSession";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import ServicesClient from "./ServicesClient";

export default async function ServicesPage() {
  const session = await getAdminSession();
  const barber = session?.barber;

  if (!barber) redirect("/login");

  const { data: services, error } = await supabaseAdmin
    .from("barber_services")
    .select(
      `
      id,
      display_name,
      name,
      price,
      duration,
      active,
      sort_order
    `,
    )
    .eq("barber_id", barber.id)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("SERVICES LOAD ERROR:", error);
  }

  return <ServicesClient services={services ?? []} barberId={barber.id} />;
}

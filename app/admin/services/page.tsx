import { requireActsAsBarber } from "../lib/requireActsAsBarber";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import SetupChecklistStepMarker from "../components/SetupChecklistStepMarker";
import ServicesClient from "./ServicesClient";

export default async function ServicesPage() {
  const session = await requireActsAsBarber();
  const barber = session.barber;
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

  return (
    <>
      <SetupChecklistStepMarker barberId={barber.id} step="services" />
      <ServicesClient services={services ?? []} barberId={barber.id} />
    </>
  );
}

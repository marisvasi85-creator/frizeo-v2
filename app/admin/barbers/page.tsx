import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";

import BarbersClient from "./BarbersClient";

export default async function BarbersPage() {
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  const { count: activeBarbers } = await supabase
    .from("barbers")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("tenant_id", barber.tenant_id)
    .eq("active", true);

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(`
      plan:plans (
        name,
        max_barbers
      )
    `)
    .eq("tenant_id", barber.tenant_id)
    .single();

  const plan = subscription?.plan as any;

  return (
    <BarbersClient
      currentPlan={plan?.name ?? "Free"}
      activeBarbers={activeBarbers ?? 0}
      maxBarbers={plan?.max_barbers ?? 1}
    />
  );
}
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import BarbersClient from "./BarbersClient";

export default async function BarbersPage() {
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }
const role = await getCurrentRole();

if (role !== "owner") {
  redirect("/admin/dashboard");
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
    status,
    trial_ends_at,
    plan:plans (
      name,
      max_barbers
    )
  `)
  .eq("tenant_id", barber.tenant_id)
  .single();

const { data: tenant } = await supabase
  .from("tenants")
  .select("slug")
  .eq("id", barber.tenant_id)
  .single();

  const plan = subscription?.plan as any;
  const isTrial =
  subscription?.status === "trialing";

const trialEnds =
  subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at)
    : null;

const trialDaysLeft =
  trialEnds
    ? Math.max(
        0,
        Math.ceil(
          (trialEnds.getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <BarbersClient
  currentPlan={
    isTrial
      ? `🚀 Trial Gratuit (${trialDaysLeft} zile)`
      : plan?.name ?? "Free"
  }
  activeBarbers={activeBarbers ?? 0}
  maxBarbers={plan?.max_barbers ?? 1}
  tenantSlug={tenant?.slug ?? ""}
/>
  );
}
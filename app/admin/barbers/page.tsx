import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { canInviteBarber } from "@/lib/limits/checkBarberLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app/getAppUrl";
import BarbersClient from "./BarbersClient";

export default async function BarbersPage() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  const role = await getCurrentRole();

  if (role !== "owner") {
    redirect("/admin/dashboard");
  }

  const tenantId = barber.tenant_id;

  const { count: activeBarbers } = await supabaseAdmin
    .from("barbers")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("tenant_id", tenantId)
    .eq("active", true);

  const { count: pendingInvites } = await supabaseAdmin
    .from("barber_invitations")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("tenant_id", tenantId)
    .eq("accepted", false);

  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select(`
      status,
      trial_ends_at,
      plan:plans (
        name,
        max_barbers
      )
    `)
    .eq("tenant_id", tenantId)
    .single();

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .single();

  const plan = subscription?.plan as
    | { name?: string; max_barbers?: number | null }
    | null
    | undefined;

  const isTrial = subscription?.status === "trialing";

  const trialEnds = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at)
    : null;

  const trialDaysLeft = trialEnds
    ? Math.max(
        0,
        Math.ceil(
          (trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const inviteAllowed = await canInviteBarber(tenantId);

  return (
    <BarbersClient
      currentPlan={
        isTrial
          ? `🚀 Trial Gratuit (${trialDaysLeft} zile)`
          : plan?.name ?? "Free"
      }
      activeBarbers={activeBarbers ?? 0}
      pendingInvites={pendingInvites ?? 0}
      maxBarbers={plan?.max_barbers ?? null}
      canInvite={inviteAllowed}
      tenantSlug={tenant?.slug ?? ""}
      appUrl={getAppUrl()}
    />
  );
}

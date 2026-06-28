import { supabaseAdmin } from "@/lib/supabase/admin";

export type BarberLimitState = {
  limit: number | null;
  activeCount: number;
  pendingInviteCount: number;
  slotsUsed: number;
  unlimited: boolean;
};

export async function getBarberLimitState(
  tenantId: string
): Promise<BarberLimitState | null> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_id")
    .eq("tenant_id", tenantId)
    .single();

  if (!sub) return null;

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("max_barbers")
    .eq("id", sub.plan_id)
    .single();

  const limit = plan?.max_barbers ?? null;
  const unlimited = limit === null;

  const { count: activeCount } = await supabaseAdmin
    .from("barbers")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("active", true);

  const { count: pendingInviteCount } = await supabaseAdmin
    .from("barber_invitations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("accepted", false);

  const active = activeCount ?? 0;
  const pending = pendingInviteCount ?? 0;

  return {
    limit,
    activeCount: active,
    pendingInviteCount: pending,
    slotsUsed: active + pending,
    unlimited,
  };
}

/** Frizer activ nou (create direct sau activare). */
export async function canCreateBarber(tenantId: string): Promise<boolean> {
  const state = await getBarberLimitState(tenantId);
  if (!state) return false;
  if (state.unlimited) return true;
  return state.activeCount < state.limit!;
}

/** Invitație nouă (frizeri activi + invitații în așteptare). */
export async function canInviteBarber(tenantId: string): Promise<boolean> {
  const state = await getBarberLimitState(tenantId);
  if (!state) return false;
  if (state.unlimited) return true;
  return state.slotsUsed < state.limit!;
}

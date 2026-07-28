import { supabaseAdmin } from "@/lib/supabase/admin";

export type BarberLimitState = {
  limit: number | null;
  activeCount: number;
  pendingInviteCount: number;
  /** Locuri ocupate de plan = doar frizeri activi (invitațiile nu consumă locuri). */
  slotsUsed: number;
  unlimited: boolean;
};

export const BARBER_LIMIT_EXCEEDED_CODE = "BARBER_LIMIT_EXCEEDED" as const;

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
    slotsUsed: active,
    unlimited,
  };
}

/** Frizer activ nou (create direct, accept invitație sau activare). */
export async function canCreateBarber(tenantId: string): Promise<boolean> {
  const state = await getBarberLimitState(tenantId);
  if (!state) return false;
  if (state.unlimited) return true;
  return state.activeCount < state.limit!;
}

/**
 * Invitațiile nu sunt limitate de plan.
 * Limita se aplică doar la activarea / acceptarea unui frizer.
 */
export async function canInviteBarber(tenantId: string): Promise<boolean> {
  const state = await getBarberLimitState(tenantId);
  return Boolean(state);
}

export function isOverActiveBarberLimit(state: BarberLimitState): boolean {
  if (state.unlimited || state.limit === null) return false;
  return state.activeCount > state.limit;
}

/** Verifică dacă un plan țintă poate fi activat cu frizerii activi actuali. */
export async function planFitsActiveBarbers(
  tenantId: string,
  maxBarbers: number | null
): Promise<
  | { ok: true; activeCount: number; limit: number | null }
  | { ok: false; activeCount: number; limit: number }
> {
  const { count } = await supabaseAdmin
    .from("barbers")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("active", true);

  const activeCount = count ?? 0;

  if (maxBarbers === null) {
    return { ok: true, activeCount, limit: null };
  }

  if (activeCount > maxBarbers) {
    return { ok: false, activeCount, limit: maxBarbers };
  }

  return { ok: true, activeCount, limit: maxBarbers };
}

export function barberLimitExceededMessage(activeCount: number, limit: number) {
  return `Ai ${activeCount} frizeri activi, dar planul permite maximum ${limit}. Dezactivează frizeri din Frizeri până la ${limit} înainte de a continua.`;
}

export function activeBarberLimitReachedMessage(limit: number) {
  return `Ai atins limita de ${limit} frizeri activi pentru planul curent. Dezactivează un frizer sau fă upgrade.`;
}

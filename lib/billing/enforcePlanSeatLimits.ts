import { supabaseAdmin } from "@/lib/supabase/admin";

export type EnforcePlanSeatsResult = {
  deactivatedBarberIds: string[];
  deletedPendingInvites: number;
};

/**
 * After downgrade to Free/Pro: keep at most `maxBarbers` active barbers
 * (prefer owner-as-barber, then oldest actives) and delete pending invites.
 * Custom (null) = no-op.
 */
export async function enforcePlanSeatLimits(
  tenantId: string,
  maxBarbers: number | null,
  options?: { clearPendingInvites?: boolean },
): Promise<EnforcePlanSeatsResult> {
  const clearPendingInvites = options?.clearPendingInvites ?? maxBarbers === 1;

  let deletedPendingInvites = 0;
  if (clearPendingInvites) {
    const { data: deleted } = await supabaseAdmin
      .from("barber_invitations")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("accepted", false)
      .select("id");
    deletedPendingInvites = deleted?.length ?? 0;
  }

  if (maxBarbers === null) {
    return { deactivatedBarberIds: [], deletedPendingInvites };
  }

  const [{ data: activeBarbers }, { data: ownerRow }] = await Promise.all([
    supabaseAdmin
      .from("barbers")
      .select("id, user_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .maybeSingle(),
  ]);

  const actives = activeBarbers ?? [];
  if (actives.length <= maxBarbers) {
    return { deactivatedBarberIds: [], deletedPendingInvites };
  }

  const ownerUserId = ownerRow?.user_id ?? null;
  const keepIds = new Set<string>();
  const ownerActive = actives.find((b) => b.user_id === ownerUserId);
  if (ownerActive) {
    keepIds.add(ownerActive.id);
  }

  for (const barber of actives) {
    if (keepIds.size >= maxBarbers) break;
    keepIds.add(barber.id);
  }

  const toDeactivate = actives
    .filter((b) => !keepIds.has(b.id))
    .map((b) => b.id);

  if (toDeactivate.length > 0) {
    await supabaseAdmin
      .from("barbers")
      .update({ active: false })
      .in("id", toDeactivate);
  }

  return {
    deactivatedBarberIds: toDeactivate,
    deletedPendingInvites,
  };
}

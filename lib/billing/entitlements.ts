const ENTITLED_STATUSES = new Set(["active", "trialing"]);

/**
 * Paid / trial features apply only while the subscription is active or trialing.
 * past_due / unpaid / canceled must not keep Pro entitlements.
 *
 * When status is omitted (slug-only callers), treat as entitled for backward
 * compatibility — prefer passing status from getCurrentPlan.
 */
export function subscriptionEntitlementsActive(
  status: string | null | undefined
): boolean {
  if (status == null || status === "") return true;
  return ENTITLED_STATUSES.has(status);
}

export function planHasActiveEntitlements(
  plan: { status?: string | null } | null | undefined
): boolean {
  if (!plan) return false;
  return subscriptionEntitlementsActive(plan.status);
}

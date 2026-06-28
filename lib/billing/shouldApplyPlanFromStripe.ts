import type Stripe from "stripe";

const ELIGIBLE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
]);

/** Plan applies when Stripe subscription is active or trialing. */
export async function shouldApplyPlanFromStripeSubscription(
  stripeSub: Stripe.Subscription
): Promise<boolean> {
  return ELIGIBLE_STATUSES.has(stripeSub.status);
}

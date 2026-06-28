import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

const ELIGIBLE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
]);

/** Card: plan applies when subscription is active. Bank transfer: after first paid invoice. */
export async function shouldApplyPlanFromStripeSubscription(
  stripeSub: Stripe.Subscription
): Promise<boolean> {
  if (!ELIGIBLE_STATUSES.has(stripeSub.status)) {
    return false;
  }

  if (stripeSub.metadata?.payment_method !== "bank_transfer") {
    return true;
  }

  const stripe = getStripe();
  const { data: paidInvoices } = await stripe.invoices.list({
    subscription: stripeSub.id,
    status: "paid",
    limit: 1,
  });

  return paidInvoices.length > 0;
}

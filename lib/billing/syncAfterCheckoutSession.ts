import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncStripeSubscription } from "./syncStripeSubscription";
import { syncTenantBillingFromStripeCustomer } from "./syncTenantBillingFromStripeCustomer";

/**
 * Sync Stripe state after Checkout redirect.
 * Only applies when the Checkout session belongs to the logged-in tenant.
 */
export async function syncAfterCheckoutSession(
  sessionId: string,
  tenantId: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    if (
      session.mode !== "subscription" ||
      typeof session.subscription !== "string"
    ) {
      return { ok: false, reason: "not_subscription" };
    }

    const sessionTenantId = session.metadata?.tenant_id?.trim() || null;
    if (!sessionTenantId || sessionTenantId !== tenantId) {
      console.warn("syncAfterCheckoutSession: tenant mismatch", {
        sessionId,
        sessionTenantId,
        tenantId,
      });
      return { ok: false, reason: "tenant_mismatch" };
    }

    const { data: localSub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const customerId =
      typeof session.customer === "string" ? session.customer : null;

    if (
      localSub?.stripe_customer_id &&
      customerId &&
      localSub.stripe_customer_id !== customerId
    ) {
      console.warn("syncAfterCheckoutSession: customer mismatch", {
        sessionId,
        tenantId,
      });
      return { ok: false, reason: "customer_mismatch" };
    }

    const subscription = await getStripe().subscriptions.retrieve(
      session.subscription
    );

    const subTenantId = subscription.metadata?.tenant_id?.trim() || null;
    if (subTenantId && subTenantId !== tenantId) {
      console.warn("syncAfterCheckoutSession: subscription tenant mismatch", {
        sessionId,
        tenantId,
        subTenantId,
      });
      return { ok: false, reason: "subscription_tenant_mismatch" };
    }

    await syncStripeSubscription(subscription, tenantId);

    if (customerId) {
      await syncTenantBillingFromStripeCustomer(tenantId, customerId);
    }

    return { ok: true };
  } catch (err) {
    console.error("syncAfterCheckoutSession:", err);
    return { ok: false, reason: "error" };
  }
}

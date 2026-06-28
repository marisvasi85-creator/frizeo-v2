import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPlanIdBySlug } from "./getPlanIdBySlug";
import { isCanonicalPlanSlug, PLAN_SLUGS, type PlanSlug } from "./plans";
import { shouldApplyPlanFromStripeSubscription } from "./shouldApplyPlanFromStripe";
import { getPlanSlugFromStripePriceId } from "./stripePrices";

async function disableSmsForTenant(tenantId: string) {
  await supabaseAdmin
    .from("notification_settings")
    .update({
      booking_sms_enabled: false,
      reminder_sms_enabled: false,
      reschedule_sms_enabled: false,
      cancel_sms_enabled: false,
    })
    .eq("tenant_id", tenantId);
}

export async function downgradeTenantToFree(tenantId: string) {
  const freePlanId = await getPlanIdBySlug(PLAN_SLUGS.FREE);

  if (!freePlanId) {
    throw new Error("Plan Free negăsit în baza de date.");
  }

  await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "active",
      plan_id: freePlanId,
      stripe_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      trial_ends_at: null,
    })
    .eq("tenant_id", tenantId);

  await disableSmsForTenant(tenantId);
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return status;
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return status;
  }
}

export async function syncStripeSubscription(
  stripeSub: Stripe.Subscription,
  fallbackTenantId?: string
) {
  let tenantId =
    stripeSub.metadata?.tenant_id || fallbackTenantId || null;

  if (!tenantId) {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("tenant_id")
      .eq("stripe_subscription_id", stripeSub.id)
      .maybeSingle();

    tenantId = data?.tenant_id ?? null;
  }

  if (!tenantId) {
    console.error("syncStripeSubscription: tenant_id lipsă", stripeSub.id);
    return;
  }

  const priceId = stripeSub.items.data[0]?.price.id;
  let slug: PlanSlug | null = priceId
    ? getPlanSlugFromStripePriceId(priceId)
    : null;

  if (
    !slug &&
    stripeSub.metadata?.plan_slug &&
    isCanonicalPlanSlug(stripeSub.metadata.plan_slug)
  ) {
    slug = stripeSub.metadata.plan_slug;
  }

  const planIdFromSlug = slug ? await getPlanIdBySlug(slug) : null;
  let planId = planIdFromSlug;

  if (!planId && stripeSub.metadata?.plan_id) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id")
      .eq("id", stripeSub.metadata.plan_id)
      .maybeSingle();

    planId = plan?.id ?? null;
  }

  if (!planId) {
    console.error(
      "syncStripeSubscription: plan_id nerezolvat",
      { priceId, slug, subscriptionId: stripeSub.id, tenantId }
    );
  }

  const mappedStatus = mapStripeStatus(stripeSub.status);

  if (
    mappedStatus === "canceled" ||
    stripeSub.status === "incomplete_expired"
  ) {
    await downgradeTenantToFree(tenantId);
    return;
  }

  const item = stripeSub.items.data[0];
  const periodStart = item?.current_period_start;
  const periodEnd = item?.current_period_end;

  const update: Record<string, unknown> = {
    stripe_customer_id: String(stripeSub.customer),
    stripe_subscription_id: stripeSub.id,
    status: mappedStatus,
  };

  if (periodStart) {
    update.current_period_start = new Date(periodStart * 1000).toISOString();
  }

  if (periodEnd) {
    update.current_period_end = new Date(periodEnd * 1000).toISOString();
  }

  const applyPlan = await shouldApplyPlanFromStripeSubscription(stripeSub);

  if (planId && applyPlan) {
    update.plan_id = planId;
  }

  if (mappedStatus === "active" && applyPlan) {
    update.trial_ends_at = null;
  }

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update(update)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("syncStripeSubscription update:", error);
    throw error;
  }
}

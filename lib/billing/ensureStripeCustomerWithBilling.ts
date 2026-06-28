import {
  isBillingProfileComplete,
  type TenantBillingProfile,
} from "@/lib/billing/billingProfile";
import { getTenantBillingProfile } from "@/lib/billing/getTenantBillingProfile";
import { resolveStripeCustomer } from "@/lib/billing/stripeCheckout";
import { syncStripeCustomerBilling } from "@/lib/billing/syncStripeCustomerBilling";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function ensureStripeCustomerWithBilling(params: {
  tenantId: string;
  tenantName: string;
  email: string;
}): Promise<
  | { ok: true; customerId: string; profile: TenantBillingProfile }
  | { ok: false; error: string; status: number }
> {
  const profile = await getTenantBillingProfile(params.tenantId);

  if (!profile || !isBillingProfileComplete(profile)) {
    return {
      ok: false,
      error:
        "Completează datele de facturare (persoană fizică sau juridică) înainte de plată.",
      status: 400,
    };
  }

  const completeProfile = profile;

  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", params.tenantId)
    .single();

  const { customerId, clearedStaleId } = await resolveStripeCustomer({
    customerId: (subscription?.stripe_customer_id as string | null) ?? null,
    email: params.email,
    name: params.tenantName,
    tenantId: params.tenantId,
  });

  await syncStripeCustomerBilling({
    customerId,
    email: params.email,
    profile: completeProfile,
  });

  if (
    customerId !== subscription?.stripe_customer_id ||
    clearedStaleId
  ) {
    await supabaseAdmin
      .from("subscriptions")
      .update({
        stripe_customer_id: customerId,
        ...(clearedStaleId ? { stripe_subscription_id: null } : {}),
      })
      .eq("tenant_id", params.tenantId);
  }

  return { ok: true, customerId, profile: completeProfile };
}

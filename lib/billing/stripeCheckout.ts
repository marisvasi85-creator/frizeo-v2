import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

type CheckoutParams = {
  stripePriceId: string;
  customerId: string | null;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
};

export async function createSubscriptionCheckout(
  params: CheckoutParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: params.stripePriceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    subscription_data: {
      metadata: params.metadata,
    },
    locale: "ro",
  };

  if (params.customerId) {
    sessionParams.customer = params.customerId;
  } else {
    sessionParams.customer_email = params.customerEmail;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

export async function createOrReuseStripeCustomer(params: {
  customerId: string | null;
  email: string;
  name: string;
  tenantId: string;
}): Promise<string> {
  if (params.customerId) {
    return params.customerId;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      tenant_id: params.tenantId,
    },
  });

  return customer.id;
}

import Stripe from "stripe";
import type StripeTypes from "stripe";
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
): Promise<StripeTypes.Checkout.Session> {
  const stripe = getStripe();

  const sessionParams: StripeTypes.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: params.stripePriceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    subscription_data: {
      metadata: params.metadata,
    },
    locale: "ro",
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: {
      address: "auto",
      name: "auto",
    },
  };

  if (params.customerId) {
    sessionParams.customer = params.customerId;
  } else {
    sessionParams.customer_email = params.customerEmail;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

function isMissingStripeResource(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeError &&
    err.code === "resource_missing"
  );
}

export async function resolveStripeCustomer(params: {
  customerId: string | null;
  email: string;
  name: string;
  tenantId: string;
}): Promise<{ customerId: string; clearedStaleId: boolean }> {
  const stripe = getStripe();

  if (params.customerId) {
    try {
      await stripe.customers.retrieve(params.customerId);
      return { customerId: params.customerId, clearedStaleId: false };
    } catch (err) {
      if (!isMissingStripeResource(err)) {
        throw err;
      }
    }
  }

  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      tenant_id: params.tenantId,
    },
  });

  return {
    customerId: customer.id,
    clearedStaleId: Boolean(params.customerId),
  };
}

export async function retrieveActiveStripeSubscription(
  subscriptionId: string
): Promise<StripeTypes.Subscription | null> {
  const stripe = getStripe();

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    if (isMissingStripeResource(err)) {
      return null;
    }

    throw err;
  }
}

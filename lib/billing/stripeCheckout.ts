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

type BankTransferParams = {
  customerId: string;
  stripePriceId: string;
  metadata: Record<string, string>;
  daysUntilDue?: number;
};

export type PaymentMethodChoice = "card" | "bank_transfer";

export async function createSubscriptionCheckout(
  params: CheckoutParams
): Promise<StripeTypes.Checkout.Session> {
  const stripe = getStripe();

  const sessionParams: StripeTypes.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: params.stripePriceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    subscription_data: {
      metadata: params.metadata,
    },
    locale: "ro",
    billing_address_collection: "auto",
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

export async function createBankTransferSubscription(
  params: BankTransferParams
): Promise<{ subscription: StripeTypes.Subscription; invoiceUrl: string | null }> {
  const stripe = getStripe();
  const daysUntilDue =
    params.daysUntilDue ??
    Number(process.env.STRIPE_BANK_TRANSFER_DAYS_UNTIL_DUE ?? 7);

  const subscription = await stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.stripePriceId }],
    collection_method: "send_invoice",
    days_until_due: Number.isFinite(daysUntilDue) ? daysUntilDue : 7,
    payment_settings: {
      payment_method_types: ["customer_balance"],
    },
    metadata: {
      ...params.metadata,
      payment_method: "bank_transfer",
    },
  });

  let invoiceUrl: string | null = null;
  const latestInvoice = subscription.latest_invoice;
  const invoiceId =
    typeof latestInvoice === "string" ? latestInvoice : latestInvoice?.id;

  if (invoiceId) {
    let invoice = await stripe.invoices.retrieve(invoiceId);

    if (invoice.status === "draft") {
      invoice = await stripe.invoices.finalizeInvoice(invoiceId);
    }

    invoiceUrl = invoice.hosted_invoice_url ?? null;
  }

  return { subscription, invoiceUrl };
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

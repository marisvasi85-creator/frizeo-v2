import Stripe from "stripe";
import type StripeTypes from "stripe";
import { syncStripeSubscription } from "@/lib/billing/syncStripeSubscription";
import { getStripe } from "@/lib/stripe";

type ChangePlanParams = {
  subscriptionId: string;
  itemId: string;
  stripePriceId: string;
  metadata: Record<string, string>;
  tenantId: string;
};

type ChangePlanResult =
  | { ok: true }
  | { ok: false; error: string; payUrl?: string };

async function hostedInvoiceUrlForSubscription(
  subscriptionId: string
): Promise<string | null> {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });

  const latestInvoice = subscription.latest_invoice;

  if (!latestInvoice) return null;

  if (typeof latestInvoice === "string") {
    const invoice = await stripe.invoices.retrieve(latestInvoice);
    return invoice.hosted_invoice_url ?? null;
  }

  return latestInvoice.hosted_invoice_url ?? null;
}

function changePlanErrorMessage(
  err: InstanceType<typeof Stripe.errors.StripeError>
): string {
  if (err.code === "card_declined") {
    return "Cardul a fost refuzat. Finalizează plata restantă sau încearcă din nou.";
  }

  if (
    err.code === "invoice_payment_intent_requires_action" ||
    err.code === "subscription_payment_intent_requires_action"
  ) {
    return "Banca cere confirmarea plății.";
  }

  return err.message;
}

/** Schimbare plan pe abonament existent (ex. Pro → Pro+), fără Checkout. */
export async function changeSubscriptionPlan(
  params: ChangePlanParams
): Promise<ChangePlanResult> {
  const stripe = getStripe();

  try {
    const updated = await stripe.subscriptions.update(params.subscriptionId, {
      items: [{ id: params.itemId, price: params.stripePriceId }],
      proration_behavior: "create_prorations",
      payment_behavior: "error_if_incomplete",
      metadata: params.metadata,
    });

    await syncStripeSubscription(updated, params.tenantId);
    return { ok: true };
  } catch (err) {
    if (!(err instanceof Stripe.errors.StripeError)) {
      throw err;
    }

    const needsAuth =
      err instanceof Stripe.errors.StripeCardError &&
      (err.code === "invoice_payment_intent_requires_action" ||
        err.code === "subscription_payment_intent_requires_action");

    const payUrl = needsAuth
      ? await hostedInvoiceUrlForSubscription(params.subscriptionId)
      : null;

    return {
      ok: false,
      error: changePlanErrorMessage(err),
      ...(payUrl ? { payUrl } : {}),
    };
  }
}

export async function getOpenInvoicePayUrl(
  subscriptionId: string
): Promise<string | null> {
  const stripe = getStripe();

  const { data: openInvoices } = await stripe.invoices.list({
    subscription: subscriptionId,
    status: "open",
    limit: 1,
  });

  const invoice = openInvoices[0];
  if (!invoice?.hosted_invoice_url) {
    return hostedInvoiceUrlForSubscription(subscriptionId);
  }

  return invoice.hosted_invoice_url;
}

export async function retrieveActiveStripeSubscription(
  subscriptionId: string
): Promise<StripeTypes.Subscription | null> {
  const stripe = getStripe();

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeError &&
      err.code === "resource_missing"
    ) {
      return null;
    }

    throw err;
  }
}

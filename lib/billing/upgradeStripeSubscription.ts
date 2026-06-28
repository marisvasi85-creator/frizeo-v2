import Stripe from "stripe";
import type StripeTypes from "stripe";
import { syncStripeSubscription } from "@/lib/billing/syncStripeSubscription";
import { getStripe } from "@/lib/stripe";

type UpgradeParams = {
  subscriptionId: string;
  itemId: string;
  stripePriceId: string;
  metadata: Record<string, string>;
  tenantId: string;
};

type UpgradeResult =
  | { ok: true; planChanged: true }
  | { ok: false; error: string; authUrl?: string };

async function hostedInvoiceUrlForSubscription(
  subscriptionId: string
): Promise<string | null> {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });

  const latestInvoice = subscription.latest_invoice;

  if (!latestInvoice || typeof latestInvoice === "string") {
    if (typeof latestInvoice === "string") {
      const invoice = await stripe.invoices.retrieve(latestInvoice);
      return invoice.hosted_invoice_url ?? null;
    }

    return null;
  }

  return latestInvoice.hosted_invoice_url ?? null;
}

function upgradeErrorMessage(err: InstanceType<typeof Stripe.errors.StripeError>): string {
  if (err.code === "card_declined") {
    return "Cardul a fost refuzat. Actualizează metoda de plată și încearcă din nou.";
  }

  if (
    err.code === "invoice_payment_intent_requires_action" ||
    err.code === "subscription_payment_intent_requires_action"
  ) {
    return "Banca cere confirmarea plății. Urmează linkul pentru a finaliza upgrade-ul.";
  }

  return err.message;
}

/**
 * Upgrade abonament existent (ex. Pro → Pro+).
 * Stripe standard: prorata + încasare pe cardul salvat; planul se schimbă doar dacă plata reușește.
 */
export async function upgradeStripeSubscription(
  params: UpgradeParams
): Promise<UpgradeResult> {
  const stripe = getStripe();

  try {
    const updated = await stripe.subscriptions.update(params.subscriptionId, {
      items: [{ id: params.itemId, price: params.stripePriceId }],
      proration_behavior: "create_prorations",
      payment_behavior: "error_if_incomplete",
      metadata: params.metadata,
    });

    await syncStripeSubscription(updated, params.tenantId);

    return { ok: true, planChanged: true };
  } catch (err) {
    if (!(err instanceof Stripe.errors.StripeError)) {
      throw err;
    }

    const authUrl =
      err instanceof Stripe.errors.StripeCardError &&
      (err.code === "invoice_payment_intent_requires_action" ||
        err.code === "subscription_payment_intent_requires_action")
        ? await hostedInvoiceUrlForSubscription(params.subscriptionId)
        : null;

    return {
      ok: false,
      error: upgradeErrorMessage(err),
      ...(authUrl ? { authUrl } : {}),
    };
  }
}

export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<StripeTypes.BillingPortal.Session> {
  const stripe = getStripe();

  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

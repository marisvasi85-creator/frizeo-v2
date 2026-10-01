import Stripe from "stripe";
import {
  findAuditByRefundId,
  findOpenFullByInvoice,
  insertRefundAudit,
  updateRefundAudit,
} from "@/lib/billing/refundAuditStore";
import {
  cancelSubscriptionForRefund,
  findInvoiceForRefund,
  loadStripeSubscription,
  resolveInvoicePayment,
} from "@/lib/billing/stripeRefundGateway";
import { downgradeTenantToFree, syncStripeSubscription } from "@/lib/billing/syncStripeSubscription";
import {
  loadLocalByStripeCustomer,
  loadLocalByStripeSubscription,
  loadLocalSubscription,
} from "@/lib/billing/refundRuntime";
import { getStripe } from "@/lib/stripe";
import {
  applyObservedRefund,
  type ObservedRefundOutcome,
} from "@/lib/billing/subscriptionRefund";

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function syncSubscription(subscriptionId: string): Promise<void> {
  try {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncStripeSubscription(subscription);
  } catch (err) {
    const missing =
      err instanceof Stripe.errors.StripeError &&
      (err.code === "resource_missing" || /no such subscription/i.test(err.message));
    if (missing) {
      console.error("refund sync skipped, subscription missing", subscriptionId);
      return;
    }
    throw err;
  }
}

export async function observeStripeRefund(
  refund: Stripe.Refund,
): Promise<ObservedRefundOutcome> {
  const paymentIntentId = idOf(refund.payment_intent);
  const chargeId = idOf(refund.charge);
  const invoice = await findInvoiceForRefund({
    paymentIntentId,
    chargeId,
    metadataInvoiceId: refund.metadata?.stripe_invoice_id ?? null,
  });
  const payment = invoice
    ? (await resolveInvoicePayment(invoice.id)).payment
    : null;
  const stripeSubscription = invoice?.subscriptionId
    ? await loadStripeSubscription(invoice.subscriptionId)
    : null;

  return applyObservedRefund(
    {
      now: () => Date.now(),
      loadLocalBySubscription: loadLocalByStripeSubscription,
      loadLocalByCustomer: loadLocalByStripeCustomer,
      loadLocalByTenant: loadLocalSubscription,
      findByRefundId: findAuditByRefundId,
      findOpenFullByInvoice,
      insertAudit: insertRefundAudit,
      updateAudit: updateRefundAudit,
      cancelSubscription: cancelSubscriptionForRefund,
      downgradeTenant: downgradeTenantToFree,
      syncSubscription,
    },
    {
      refundId: refund.id,
      refundStatus: refund.status,
      refundAmount: refund.amount,
      currency: refund.currency,
      paymentIntentId,
      chargeId,
      metadata: refund.metadata,
      invoice,
      payment,
      stripeSubscriptionStatus: stripeSubscription?.status ?? null,
    },
  );
}

function assertReconciled(outcome: ObservedRefundOutcome) {
  if (outcome.action === "cancel_failed" || outcome.action === "downgrade_failed") {
    throw new Error(`refund reconciliation ${outcome.action}`);
  }
}

/**
 * Observes refunds created in Frizeo or directly in the Stripe Dashboard.
 * Does not create a new Stripe refund.
 */
export async function handleStripeRefundWebhookEvent(
  event: Stripe.Event,
): Promise<void> {
  if (
    event.type === "refund.created" ||
    event.type === "refund.updated" ||
    event.type === "refund.failed"
  ) {
    assertReconciled(await observeStripeRefund(event.data.object as Stripe.Refund));
    return;
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const refunds = await getStripe().refunds.list({
      charge: charge.id,
      limit: 10,
    });
    for (const refund of refunds.data) {
      assertReconciled(await observeStripeRefund(refund));
    }
  }
}

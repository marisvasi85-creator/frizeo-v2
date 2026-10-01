import Stripe from "stripe";
import type { InvoiceCandidate, PaymentFacts } from "@/lib/billing/refundDecisions";
import { getStripe } from "@/lib/stripe";

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function isMissing(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeError &&
    (err.code === "resource_missing" || err.statusCode === 404)
  );
}

export function isAlreadyRefundedError(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeError &&
    err.code === "charge_already_refunded"
  );
}

export function isRefundInProgressError(err: unknown): boolean {
  return err instanceof Stripe.errors.StripeIdempotencyError;
}

export function mapStripeInvoice(invoice: Stripe.Invoice): InvoiceCandidate {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return {
    id: invoice.id,
    status: invoice.status,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    billingReason: invoice.billing_reason,
    customerId: idOf(invoice.customer),
    subscriptionId: idOf(subscription),
    paidAt: invoice.status_transitions?.paid_at ?? null,
    created: invoice.created,
  };
}

export async function loadStripeSubscription(subscriptionId: string): Promise<{
  id: string;
  customerId: string | null;
  status: string;
} | null> {
  try {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    return {
      id: subscription.id,
      customerId: idOf(subscription.customer),
      status: subscription.status,
    };
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

export async function listPaidInvoices(
  subscriptionId: string,
): Promise<InvoiceCandidate[]> {
  const list = await getStripe().invoices.list({
    subscription: subscriptionId,
    status: "paid",
    limit: 12,
  });
  return list.data.map(mapStripeInvoice);
}

async function chargeFacts(
  charge: Stripe.Charge,
): Promise<Pick<PaymentFacts, "chargeId" | "amount" | "amountRefunded" | "fullyRefunded" | "currency">> {
  return {
    chargeId: charge.id,
    amount: charge.amount,
    amountRefunded: charge.amount_refunded,
    fullyRefunded: charge.refunded,
    currency: charge.currency,
  };
}

export async function resolveInvoicePayment(invoiceId: string): Promise<{
  payment: PaymentFacts | null;
  actionRequired: boolean;
}> {
  const stripe = getStripe();
  const payments = await stripe.invoicePayments.list({
    invoice: invoiceId,
    limit: 10,
  });

  const paid = payments.data
    .filter((payment) => payment.status === "paid" && (payment.amount_paid ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.status_transitions.paid_at ?? b.created) -
        (a.status_transitions.paid_at ?? a.created),
    );
  const chosen = paid[0];
  if (!chosen) return { payment: null, actionRequired: false };

  const paymentIntentId = idOf(chosen.payment.payment_intent);
  const directChargeId = idOf(chosen.payment.charge);

  let charge: Stripe.Charge | null = null;
  if (directChargeId) {
    charge = await stripe.charges.retrieve(directChargeId);
  } else if (paymentIntentId) {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const latestChargeId = idOf(intent.latest_charge);
    if (latestChargeId) charge = await stripe.charges.retrieve(latestChargeId);
  }

  const refundLookupId = paymentIntentId || charge?.id || directChargeId;
  const refunds = refundLookupId
    ? await stripe.refunds.list({
        ...(paymentIntentId
          ? { payment_intent: paymentIntentId }
          : { charge: charge?.id ?? directChargeId ?? undefined }),
        limit: 20,
      })
    : { data: [] as Stripe.Refund[] };
  const actionRequired = refunds.data.some(
    (refund) => refund.status === "requires_action",
  );

  if (!charge && !paymentIntentId) {
    return { payment: null, actionRequired };
  }

  const facts = charge ? await chargeFacts(charge) : null;
  const refundedFromList = refunds.data
    .filter((refund) => refund.status === "succeeded" || refund.status === "pending")
    .reduce((sum, refund) => sum + refund.amount, 0);

  return {
    actionRequired,
    payment: {
      paymentIntentId,
      chargeId: facts?.chargeId ?? directChargeId,
      amount: facts?.amount ?? chosen.amount_paid ?? 0,
      amountRefunded: facts?.amountRefunded ?? refundedFromList,
      fullyRefunded:
        facts?.fullyRefunded ??
        (facts ? refundedFromList >= facts.amount : refundedFromList > 0 && refundedFromList >= (chosen.amount_paid ?? 0)),
      currency: facts?.currency ?? chosen.currency,
    },
  };
}

export async function listPaymentRefunds(input: {
  paymentIntentId: string | null;
  chargeId: string | null;
}): Promise<
  Array<{
    id: string;
    amount: number;
    status: string | null;
    metadata: Record<string, string> | null;
  }>
> {
  if (!input.paymentIntentId && !input.chargeId) return [];
  const list = await getStripe().refunds.list({
    ...(input.paymentIntentId
      ? { payment_intent: input.paymentIntentId }
      : { charge: input.chargeId ?? undefined }),
    limit: 20,
  });
  return list.data.map((refund) => ({
    id: refund.id,
    amount: refund.amount,
    status: refund.status,
    metadata: refund.metadata,
  }));
}

export async function createFullRefund(input: {
  paymentIntentId: string | null;
  chargeId: string | null;
  amount: number;
  currency: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; status: string | null; amount: number }> {
  const refund = await getStripe().refunds.create(
    {
      ...(input.paymentIntentId
        ? { payment_intent: input.paymentIntentId }
        : { charge: input.chargeId ?? undefined }),
      amount: input.amount,
      reason: "requested_by_customer",
      metadata: input.metadata,
    },
    { idempotencyKey: input.idempotencyKey },
  );
  return { id: refund.id, status: refund.status, amount: refund.amount };
}

export async function cancelSubscriptionForRefund(
  subscriptionId: string,
): Promise<void> {
  const stripe = getStripe();
  try {
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    if (
      current.status === "canceled" ||
      current.status === "incomplete_expired"
    ) {
      return;
    }
  } catch (err) {
    if (isMissing(err)) return;
    throw err;
  }

  try {
    await stripe.subscriptions.cancel(subscriptionId, {
      invoice_now: false,
      prorate: false,
      cancellation_details: { comment: "Frizeo platform refund" },
    });
  } catch (err) {
    if (isMissing(err)) return;
    if (
      err instanceof Stripe.errors.StripeError &&
      /canceled/i.test(err.message)
    ) {
      return;
    }
    throw err;
  }
}

export async function findInvoiceForRefund(input: {
  paymentIntentId: string | null;
  chargeId: string | null;
  metadataInvoiceId: string | null;
}): Promise<InvoiceCandidate | null> {
  const stripe = getStripe();
  if (input.metadataInvoiceId) {
    try {
      const invoice = await stripe.invoices.retrieve(input.metadataInvoiceId);
      return mapStripeInvoice(invoice);
    } catch (err) {
      if (!isMissing(err)) throw err;
    }
  }

  if (input.paymentIntentId) {
    const payments = await stripe.invoicePayments.list({
      payment: { type: "payment_intent", payment_intent: input.paymentIntentId },
      limit: 5,
    });
    const invoiceId = idOf(payments.data[0]?.invoice);
    if (invoiceId) {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      return mapStripeInvoice(invoice);
    }
  }

  if (!input.chargeId) return null;
  const charge = await stripe.charges.retrieve(input.chargeId);
  const customerId = idOf(charge.customer);
  if (!customerId) return null;
  const invoices = await stripe.invoices.list({
    customer: customerId,
    status: "paid",
    limit: 10,
  });
  for (const invoice of invoices.data) {
    const payments = await stripe.invoicePayments.list({
      invoice: invoice.id,
      limit: 10,
    });
    const match = payments.data.some((payment) => {
      return (
        idOf(payment.payment.charge) === input.chargeId ||
        idOf(payment.payment.payment_intent) === input.paymentIntentId
      );
    });
    if (match) return mapStripeInvoice(invoice);
  }
  return null;
}

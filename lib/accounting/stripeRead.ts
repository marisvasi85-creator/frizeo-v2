import type Stripe from "stripe";
import { INVOICE_PAYMENT_LOOKBACK_SECONDS } from "@/lib/accounting/period";
import type { AccountingPeriod } from "@/lib/accounting/period";
import { isSucceededRefundStatus } from "@/lib/accounting/money";
import { idOf, isCollectedCharge, refundsRecognizedInPeriod } from "@/lib/accounting/report";
import type {
  ChargeSnapshot,
  InvoicePaymentSnapshot,
  InvoiceSnapshot,
  RefundSnapshot,
  StripeAccountingClient,
  StripeList,
} from "@/lib/accounting/types";

const PAGE_SIZE = 100;
const MAX_PAGES = 40;
const RETRIEVE_CONCURRENCY = 5;

export class AccountingReadError extends Error {}

async function paginate<T extends { id: string }>(
  fetchPage: (startingAfter?: string) => Promise<StripeList<T>>,
  label: string,
): Promise<T[]> {
  const all: T[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await fetchPage(startingAfter);
    all.push(...result.data);
    if (!result.has_more || result.data.length === 0) return all;
    const last = result.data[result.data.length - 1];
    if (!last?.id || last.id === startingAfter) {
      throw new AccountingReadError(`Paginare Stripe întreruptă la ${label}.`);
    }
    startingAfter = last.id;
  }
  throw new AccountingReadError(
    "Prea multe înregistrări Stripe pentru un singur raport. Îngustează intervalul.",
  );
}

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

type StripeInvoiceLike = {
  id: string;
  number?: string | null;
  status?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  total?: number | null;
  amount_paid?: number | null;
  customer?: string | { id: string } | Stripe.Customer | Stripe.DeletedCustomer | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_address?: InvoiceSnapshot["customer_address"];
  customer_tax_ids?: Array<{ type: string; value: string | null }> | null;
  total_taxes?: Array<{ amount: number }> | null;
  parent?: {
    subscription_details?: {
      subscription?: string | { id: string } | null;
    } | null;
  } | null;
  lines?: {
    data?: Array<{
      id: string;
      description?: string | null;
      amount?: number | null;
      period?: { start: number; end: number };
      pricing?: {
        price_details?: { price?: string | { id: string } | null } | null;
      } | null;
      parent?: {
        subscription_item_details?: { subscription?: string | null } | null;
        invoice_item_details?: { subscription?: string | null } | null;
      } | null;
      subscription?: string | { id: string } | null;
    }>;
    has_more?: boolean;
  } | null;
};

function linePriceId(line: NonNullable<NonNullable<StripeInvoiceLike["lines"]>["data"]>[number]): string | null {
  const price = line.pricing?.price_details?.price;
  return idOf(price ?? null);
}

function lineSubscriptionId(
  line: NonNullable<NonNullable<StripeInvoiceLike["lines"]>["data"]>[number],
): string | null {
  return (
    line.parent?.subscription_item_details?.subscription ??
    line.parent?.invoice_item_details?.subscription ??
    idOf(line.subscription ?? null)
  );
}

export function normalizeStripeInvoice(invoice: StripeInvoiceLike): InvoiceSnapshot {
  const lines = invoice.lines?.data ?? [];
  const subscriptionFromParent = idOf(
    invoice.parent?.subscription_details?.subscription ?? null,
  );
  const subscriptionFromLine =
    lines.map(lineSubscriptionId).find((id): id is string => Boolean(id)) ?? null;

  return {
    id: invoice.id,
    number: invoice.number ?? null,
    status: invoice.status ?? null,
    currency: invoice.currency ?? null,
    subtotal: invoice.subtotal ?? null,
    total: invoice.total ?? null,
    amount_paid: invoice.amount_paid ?? null,
    customer: idOf(invoice.customer as string | { id: string } | null),
    customer_name: invoice.customer_name ?? null,
    customer_email: invoice.customer_email ?? null,
    customer_address: invoice.customer_address ?? null,
    customer_tax_ids: invoice.customer_tax_ids ?? null,
    total_taxes: invoice.total_taxes ?? null,
    subscriptionId: subscriptionFromParent ?? subscriptionFromLine,
    lines: lines.map((line) => ({
      description: line.description ?? null,
      amount: line.amount ?? null,
      period: line.period ?? null,
      priceId: linePriceId(line),
    })),
    linesHasMore: invoice.lines?.has_more === true,
  };
}

export function normalizeStripeCharge(charge: Stripe.Charge | ChargeSnapshot): ChargeSnapshot {
  return {
    id: charge.id,
    amount: charge.amount,
    amount_refunded: charge.amount_refunded,
    currency: charge.currency,
    created: charge.created,
    paid: charge.paid,
    status: charge.status,
    customer: idOf(charge.customer as string | { id: string } | null),
    payment_intent: idOf(
      charge.payment_intent as string | { id: string } | null,
    ),
    refunds: charge.refunds
      ? {
          has_more: charge.refunds.has_more,
          data: (charge.refunds.data ?? []).map((refund) => ({
            id: refund.id,
            amount: refund.amount,
            status: refund.status,
          })),
        }
      : null,
  };
}

export function normalizeStripeInvoicePayment(
  payment: Stripe.InvoicePayment | InvoicePaymentSnapshot,
): InvoicePaymentSnapshot {
  return {
    id: payment.id,
    status: payment.status,
    amount_paid: payment.amount_paid,
    currency: payment.currency,
    created: payment.created,
    invoice: idOf(payment.invoice as string | { id: string } | null),
    payment: {
      type: payment.payment.type,
      payment_intent: idOf(
        payment.payment.payment_intent as string | { id: string } | null | undefined,
      ),
      charge: idOf(payment.payment.charge as string | { id: string } | null | undefined),
    },
    status_transitions: {
      paid_at: payment.status_transitions?.paid_at ?? null,
    },
  };
}

type StripeRefundLike = {
  id: string;
  amount: number;
  status: string | null;
  created: number;
  currency?: string | null;
  charge?: string | Stripe.Charge | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
};

export function normalizeStripeRefund(refund: StripeRefundLike): RefundSnapshot & {
  charge?: ChargeSnapshot | null;
} {
  const chargeObject =
    refund.charge && typeof refund.charge === "object" ? refund.charge : null;
  return {
    id: refund.id,
    amount: refund.amount,
    status: refund.status,
    created: refund.created,
    currency: refund.currency ?? chargeObject?.currency ?? null,
    chargeId: idOf(refund.charge as string | { id: string } | null),
    paymentIntentId: idOf(refund.payment_intent as string | { id: string } | null),
    charge: chargeObject ? normalizeStripeCharge(chargeObject) : null,
  };
}

type StripeReadApi = {
  charges: {
    list: Stripe["charges"]["list"];
    retrieve: Stripe["charges"]["retrieve"];
  };
  invoicePayments: {
    list: Stripe["invoicePayments"]["list"];
  };
  invoices: {
    list: Stripe["invoices"]["list"];
    retrieve: Stripe["invoices"]["retrieve"];
    listLineItems: Stripe["invoices"]["listLineItems"];
  };
  refunds: {
    list: Stripe["refunds"]["list"];
  };
};

/** Doar list/retrieve. Nu expune create, update, cancel sau refund. */
export function stripeAccountingClient(stripe: StripeReadApi): StripeAccountingClient {
  return {
    charges: {
      list: async (params) => {
        const page = await stripe.charges.list(params);
        return {
          has_more: page.has_more,
          data: page.data.map((charge) => normalizeStripeCharge(charge)),
        };
      },
      retrieve: async (id) => normalizeStripeCharge(await stripe.charges.retrieve(id)),
    },
    invoicePayments: {
      list: async (params) => {
        const page = await stripe.invoicePayments.list(params);
        return {
          has_more: page.has_more,
          data: page.data.map((payment) => normalizeStripeInvoicePayment(payment)),
        };
      },
    },
    invoices: {
      list: async (params) => {
        const page = await stripe.invoices.list(params);
        return {
          has_more: page.has_more,
          data: page.data.map((invoice) => normalizeStripeInvoice(invoice)),
        };
      },
      retrieve: async (id) => normalizeStripeInvoice(await stripe.invoices.retrieve(id)),
      listLineItems: async (id, params) => {
        const page = await stripe.invoices.listLineItems(id, params);
        return {
          has_more: page.has_more,
          data: page.data.map((line) => ({
            id: line.id,
            description: line.description,
            amount: line.amount,
            period: line.period,
            priceId: linePriceId(line),
          })),
        };
      },
    },
    refunds: {
      list: async (params) => {
        const page = await stripe.refunds.list(params);
        return {
          has_more: page.has_more,
          data: page.data.map((refund) => normalizeStripeRefund(refund)),
        };
      },
    },
  };
}

async function hydrateLines(
  client: StripeAccountingClient,
  invoice: InvoiceSnapshot,
): Promise<InvoiceSnapshot> {
  if (!invoice.linesHasMore) return invoice;
  const lines = await paginate(
    (startingAfter) =>
      client.invoices.listLineItems(invoice.id, {
        limit: PAGE_SIZE,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      }),
    `invoice lines ${invoice.id}`,
  );
  return {
    ...invoice,
    lines: lines.map((line) => ({
      description: line.description ?? null,
      amount: line.amount ?? null,
      period: line.period ?? null,
      priceId: line.priceId ?? null,
    })),
    linesHasMore: false,
  };
}

export async function readStripePayments(
  client: StripeAccountingClient,
  period: AccountingPeriod,
): Promise<{
  charges: ChargeSnapshot[];
  contextCharges: ChargeSnapshot[];
  refunds: RefundSnapshot[];
  invoicePayments: InvoicePaymentSnapshot[];
  invoices: InvoiceSnapshot[];
}> {
  const created = { gte: period.startUnix, lt: period.endUnix };
  const charges = await paginate(
    (startingAfter) =>
      client.charges.list({
        limit: PAGE_SIZE,
        created,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      }),
    "charges",
  );

  const collected = charges.filter(
    (charge) =>
      isCollectedCharge(charge) &&
      charge.created >= period.startUnix &&
      charge.created < period.endUnix,
  );
  const uniqueCharges: ChargeSnapshot[] = [];
  const seenCharges = new Set<string>();
  for (const charge of collected) {
    if (seenCharges.has(charge.id)) continue;
    seenCharges.add(charge.id);
    uniqueCharges.push(charge);
  }

  const listedRefunds = await paginate(
    (startingAfter) =>
      client.refunds.list({
        limit: PAGE_SIZE,
        created,
        expand: ["data.charge"],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      }),
    "refunds",
  );
  const refunds = refundsRecognizedInPeriod(listedRefunds, period);
  const contextCharges = await contextChargesForRefunds(
    client,
    uniqueCharges,
    listedRefunds,
  );

  if (uniqueCharges.length === 0 && refunds.length === 0) {
    return {
      charges: [],
      contextCharges: [],
      refunds: [],
      invoicePayments: [],
      invoices: [],
    };
  }

  const linkCharges = [...uniqueCharges, ...contextCharges];

  const invoicePayments = await paginate(
    (startingAfter) =>
      client.invoicePayments.list({
        limit: PAGE_SIZE,
        status: "paid",
        created: {
          gte: period.startUnix - INVOICE_PAYMENT_LOOKBACK_SECONDS,
          lt: period.endUnix,
        },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      }),
    "invoice payments",
  );

  const knownPaymentIntents = new Set(
    invoicePayments
      .map((payment) => idOf(payment.payment.payment_intent))
      .filter((id): id is string => Boolean(id)),
  );
  const knownCharges = new Set(
    invoicePayments
      .map((payment) => idOf(payment.payment.charge))
      .filter((id): id is string => Boolean(id)),
  );

  const unmatched = linkCharges.filter((charge) => {
    const paymentIntentId = idOf(charge.payment_intent);
    if (paymentIntentId && knownPaymentIntents.has(paymentIntentId)) return false;
    return !knownCharges.has(charge.id);
  });

  const fallbackPayments = (
    await mapLimited(unmatched, RETRIEVE_CONCURRENCY, async (charge) => {
      const paymentIntentId = idOf(charge.payment_intent);
      if (!paymentIntentId) return [];
      const page = await client.invoicePayments.list({
        limit: 10,
        payment: { type: "payment_intent", payment_intent: paymentIntentId },
      });
      return page.data.filter((payment) => payment.status === "paid");
    })
  ).flat();

  const payments = [...invoicePayments, ...fallbackPayments];
  const invoiceIds = new Set<string>();
  for (const charge of linkCharges) {
    const paymentIntentId = idOf(charge.payment_intent);
    const linked = payments.find((payment) => {
      const paymentIntent = idOf(payment.payment.payment_intent);
      const paymentCharge = idOf(payment.payment.charge);
      return (
        (paymentIntentId != null && paymentIntent === paymentIntentId) ||
        paymentCharge === charge.id
      );
    });
    const invoiceId = idOf(linked?.invoice);
    if (invoiceId) invoiceIds.add(invoiceId);
  }

  const invoicesById = new Map<string, InvoiceSnapshot>();
  if (invoiceIds.size > 0) {
    const listedInvoices = await paginate(
      (startingAfter) =>
        client.invoices.list({
          limit: PAGE_SIZE,
          status: "paid",
          created: {
            gte: period.startUnix - INVOICE_PAYMENT_LOOKBACK_SECONDS,
            lt: period.endUnix,
          },
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        }),
      "invoices",
    );
    for (const invoice of listedInvoices) invoicesById.set(invoice.id, invoice);
    const missingIds = [...invoiceIds].filter((id) => !invoicesById.has(id));
    const retrieved = await mapLimited(missingIds, RETRIEVE_CONCURRENCY, async (id) => {
      try {
        return await client.invoices.retrieve(id);
      } catch (err) {
        console.error(
          "accounting invoice retrieve",
          id,
          err instanceof Error ? err.message : "error",
        );
        return null;
      }
    });
    for (const invoice of retrieved) {
      if (invoice) invoicesById.set(invoice.id, invoice);
    }
  }

  const needed = [...invoiceIds]
    .map((id) => invoicesById.get(id))
    .filter((invoice): invoice is InvoiceSnapshot => Boolean(invoice));
  const invoices = await mapLimited(needed, RETRIEVE_CONCURRENCY, (invoice) =>
    hydrateLines(client, invoice),
  );

  return {
    charges: uniqueCharges,
    contextCharges,
    refunds,
    invoicePayments: payments,
    invoices,
  };
}

async function contextChargesForRefunds(
  client: StripeAccountingClient,
  periodCharges: ChargeSnapshot[],
  listedRefunds: Array<RefundSnapshot & { charge?: ChargeSnapshot | null }>,
): Promise<ChargeSnapshot[]> {
  const known = new Set(periodCharges.map((charge) => charge.id));
  const context = new Map<string, ChargeSnapshot>();
  for (const refund of listedRefunds) {
    if (!isSucceededRefundStatus(refund.status)) continue;
    const embedded = refund.charge;
    if (embedded && !known.has(embedded.id) && !context.has(embedded.id)) {
      context.set(embedded.id, embedded);
      known.add(embedded.id);
    }
  }

  const missingIds = [
    ...new Set(
      listedRefunds
        .filter((refund) => isSucceededRefundStatus(refund.status))
        .map((refund) => refund.chargeId)
        .filter((id): id is string => Boolean(id && !known.has(id))),
    ),
  ];
  if (missingIds.length === 0 || !client.charges.retrieve) return [...context.values()];

  const retrieved = await mapLimited(missingIds, RETRIEVE_CONCURRENCY, async (id) => {
    try {
      return await client.charges.retrieve!(id);
    } catch (err) {
      console.error(
        "accounting charge retrieve",
        id,
        err instanceof Error ? err.message : "error",
      );
      return null;
    }
  });
  for (const charge of retrieved) {
    if (charge && !context.has(charge.id)) context.set(charge.id, charge);
  }
  return [...context.values()];
}

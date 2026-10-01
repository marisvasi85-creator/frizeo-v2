import { getPlanSlugFromStripePriceId } from "@/lib/billing/stripePrices";
import {
  accountingStatus,
  isSucceededRefundStatus,
  minorToMajor,
  netMinor,
  taxMinorFromTotalTaxes,
} from "@/lib/accounting/money";
import {
  formatBucharestDate,
  formatBucharestDateTime,
  isInAccountingPeriod,
  type AccountingPeriod,
} from "@/lib/accounting/period";
import type {
  AccountingReport,
  AccountingRow,
  ChargeSnapshot,
  CurrencyTotals,
  InvoiceLineSnapshot,
  InvoicePaymentSnapshot,
  InvoiceSnapshot,
  RefundSnapshot,
  TenantMatch,
} from "@/lib/accounting/types";

const PLAN_LABELS: Record<string, string> = {
  pro: "Pro",
  "pro-plus": "Pro+",
};

export function isCollectedCharge(charge: {
  status: string;
  paid: boolean;
  amount: number;
}): boolean {
  return charge.status === "succeeded" && charge.paid === true && charge.amount > 0;
}

export function idOf(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function defaultPlanLabel(priceId: string): string | null {
  const slug = getPlanSlugFromStripePriceId(priceId);
  return slug ? (PLAN_LABELS[slug] ?? null) : null;
}

export function pickInvoiceLine(
  lines: InvoiceLineSnapshot[] | undefined,
): InvoiceLineSnapshot | null {
  if (!lines || lines.length === 0) return null;
  const positive = lines.filter((line) => (line.amount ?? 0) > 0);
  const pool = positive.length > 0 ? positive : lines;
  return [...pool].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0] ?? null;
}

function stripeTaxId(invoice: InvoiceSnapshot | null): string | null {
  const ids = invoice?.customer_tax_ids ?? [];
  const chosen =
    ids.find((id) => id.type === "ro_tin" && id.value) ??
    ids.find((id) => id.type === "eu_vat" && id.value) ??
    ids.find((id) => id.value);
  return blankToNull(chosen?.value);
}

function formatStripeAddress(
  address: InvoiceSnapshot["customer_address"],
): string | null {
  if (!address) return null;
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function formatTenantAddress(tenant: TenantMatch | null): string | null {
  if (!tenant) return null;
  const parts = [
    tenant.addressLine1,
    tenant.city,
    tenant.county,
    tenant.postalCode,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function matchTenant(
  tenants: TenantMatch[],
  customerId: string | null,
  subscriptionId: string | null,
): TenantMatch | null {
  if (subscriptionId) {
    const bySubscription = tenants.find(
      (tenant) => tenant.stripeSubscriptionId === subscriptionId,
    );
    if (bySubscription) return bySubscription;
  }
  if (customerId) {
    return (
      tenants.find((tenant) => tenant.stripeCustomerId === customerId) ?? null
    );
  }
  return null;
}

function indexInvoicePayments(payments: InvoicePaymentSnapshot[]) {
  const byPaymentIntent = new Map<string, InvoicePaymentSnapshot>();
  const byCharge = new Map<string, InvoicePaymentSnapshot>();
  const ranked = [...payments].filter((payment) => payment.status === "paid");
  ranked.sort(
    (a, b) =>
      (b.status_transitions?.paid_at ?? b.created) -
      (a.status_transitions?.paid_at ?? a.created),
  );
  for (const payment of ranked) {
    const paymentIntentId = idOf(payment.payment.payment_intent);
    const chargeId = idOf(payment.payment.charge);
    if (paymentIntentId && !byPaymentIntent.has(paymentIntentId)) {
      byPaymentIntent.set(paymentIntentId, payment);
    }
    if (chargeId && !byCharge.has(chargeId)) byCharge.set(chargeId, payment);
  }
  return { byPaymentIntent, byCharge };
}

function roundMajor(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function currencySort(left: string, right: string): number {
  const preferred = ["RON", "EUR"];
  const leftIndex = preferred.indexOf(left);
  const rightIndex = preferred.indexOf(right);
  if (leftIndex !== -1 || rightIndex !== -1) {
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  }
  return left.localeCompare(right);
}

export function totalsByCurrency(rows: AccountingRow[]): CurrencyTotals[] {
  const byCurrency = new Map<string, CurrencyTotals>();
  for (const row of rows) {
    const current = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      paymentCount: 0,
      collected: 0,
      refunded: 0,
      net: 0,
    };
    if (row.paid > 0) current.paymentCount += 1;
    current.collected = roundMajor(current.collected + row.paid);
    current.refunded = roundMajor(current.refunded + row.refunded);
    current.net = roundMajor(current.net + row.net);
    byCurrency.set(row.currency, current);
  }
  return [...byCurrency.values()].sort((a, b) =>
    currencySort(a.currency, b.currency),
  );
}

function refundMatchesCharge(refund: RefundSnapshot, charge: ChargeSnapshot): boolean {
  if (refund.chargeId && refund.chargeId === charge.id) return true;
  const paymentIntentId = idOf(charge.payment_intent);
  return Boolean(paymentIntentId && refund.paymentIntentId === paymentIntentId);
}

/** Refund reușit a cărui dată `created` cade în perioada contabilă. */
export function refundsRecognizedInPeriod(
  refunds: RefundSnapshot[],
  period: Pick<AccountingPeriod, "startUnix" | "endUnix">,
): RefundSnapshot[] {
  const seen = new Set<string>();
  const recognized: RefundSnapshot[] = [];
  for (const refund of refunds) {
    if (!refund.id || seen.has(refund.id)) continue;
    if (!isSucceededRefundStatus(refund.status) || refund.amount <= 0) continue;
    if (!isInAccountingPeriod(refund.created, period)) continue;
    seen.add(refund.id);
    recognized.push(refund);
  }
  return recognized;
}

export function buildAccountingReport(input: {
  charges: ChargeSnapshot[];
  contextCharges?: ChargeSnapshot[];
  refunds?: RefundSnapshot[];
  invoicePayments: InvoicePaymentSnapshot[];
  invoices: InvoiceSnapshot[];
  tenants: TenantMatch[];
  period: AccountingPeriod;
  generatedAt?: Date;
  planLabelForPriceId?: (priceId: string) => string | null;
}): AccountingReport {
  const planLabelForPriceId = input.planLabelForPriceId ?? defaultPlanLabel;
  const invoicesById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));
  const links = indexInvoicePayments(input.invoicePayments);
  const recognizedRefunds = refundsRecognizedInPeriod(input.refunds ?? [], input.period);
  const chargeById = new Map<string, ChargeSnapshot>();
  for (const charge of [...input.charges, ...(input.contextCharges ?? [])]) {
    if (!chargeById.has(charge.id)) chargeById.set(charge.id, charge);
  }
  const seen = new Set<string>();
  const rows: AccountingRow[] = [];
  const consumedRefundIds = new Set<string>();

  const charges = [...input.charges].sort(
    (a, b) => a.created - b.created || a.id.localeCompare(b.id),
  );

  for (const charge of charges) {
    if (!isCollectedCharge(charge)) continue;
    if (!isInAccountingPeriod(charge.created, input.period)) continue;
    if (seen.has(charge.id)) continue;
    seen.add(charge.id);

    const matchedRefunds = recognizedRefunds.filter((refund) =>
      refundMatchesCharge(refund, charge),
    );
    for (const refund of matchedRefunds) consumedRefundIds.add(refund.id);
    const refundedMinor = matchedRefunds.reduce((sum, refund) => sum + refund.amount, 0);
    rows.push(
      collectionRow({
        charge,
        refundedMinor,
        includeInvoiceAmounts: true,
        eventUnix: charge.created,
        links,
        invoicesById,
        tenants: input.tenants,
        planLabelForPriceId,
      }),
    );
  }

  const laterRefunds = recognizedRefunds
    .filter((refund) => !consumedRefundIds.has(refund.id))
    .sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));

  for (const refund of laterRefunds) {
    const charge =
      (refund.chargeId ? chargeById.get(refund.chargeId) : undefined) ??
      [...chargeById.values()].find((candidate) => refundMatchesCharge(refund, candidate)) ??
      null;
    rows.push(
      refundOnlyRow({
        refund,
        charge,
        links,
        invoicesById,
        tenants: input.tenants,
        planLabelForPriceId,
      }),
    );
  }

  rows.sort((a, b) => a.paidAtUnix - b.paidAtUnix || (a.paymentId ?? "").localeCompare(b.paymentId ?? ""));

  return {
    period: input.period,
    generatedAt: formatBucharestDateTime(input.generatedAt ?? new Date()),
    rows,
    totalsByCurrency: totalsByCurrency(rows),
    paymentCount: rows.filter((row) => row.paid > 0).length,
  };
}

function collectionRow(input: {
  charge: ChargeSnapshot;
  refundedMinor: number;
  includeInvoiceAmounts: boolean;
  eventUnix: number;
  links: ReturnType<typeof indexInvoicePayments>;
  invoicesById: Map<string, InvoiceSnapshot>;
  tenants: TenantMatch[];
  planLabelForPriceId: (priceId: string) => string | null;
}): AccountingRow {
  const identity = paymentIdentity(input.charge, input);
  const currency = identity.currency;
  const paidMinor = input.charge.amount;
  const taxMinor = input.includeInvoiceAmounts
    ? taxMinorFromTotalTaxes(identity.invoice?.total_taxes)
    : null;
  return {
    ...identity.fields,
    paidAtUnix: input.eventUnix,
    paidAt: formatBucharestDateTime(new Date(input.eventUnix * 1000)),
    currency,
    subtotal:
      !input.includeInvoiceAmounts || identity.invoice?.subtotal == null
        ? null
        : roundMajor(minorToMajor(identity.invoice.subtotal, currency)),
    tax: taxMinor == null ? null : roundMajor(minorToMajor(taxMinor, currency)),
    total:
      !input.includeInvoiceAmounts || identity.invoice?.total == null
        ? null
        : roundMajor(minorToMajor(identity.invoice.total, currency)),
    paid: roundMajor(minorToMajor(paidMinor, currency)),
    refunded: roundMajor(minorToMajor(input.refundedMinor, currency)),
    net: roundMajor(minorToMajor(netMinor(paidMinor, input.refundedMinor), currency)),
    status: accountingStatus(paidMinor, input.refundedMinor),
  };
}

function refundOnlyRow(input: {
  refund: RefundSnapshot;
  charge: ChargeSnapshot | null;
  links: ReturnType<typeof indexInvoicePayments>;
  invoicesById: Map<string, InvoiceSnapshot>;
  tenants: TenantMatch[];
  planLabelForPriceId: (priceId: string) => string | null;
}): AccountingRow {
  const charge = input.charge;
  const identity = charge
    ? paymentIdentity(charge, input)
    : {
        currency: (input.refund.currency || "ron").toUpperCase(),
        invoice: null as InvoiceSnapshot | null,
        fields: emptyIdentity(input.refund),
      };
  const currency = (charge?.currency || input.refund.currency || identity.currency).toUpperCase();
  const originalMinor = charge?.amount ?? input.refund.amount;
  const refundedMinor = input.refund.amount;
  return {
    ...identity.fields,
    paidAtUnix: input.refund.created,
    paidAt: formatBucharestDateTime(new Date(input.refund.created * 1000)),
    currency,
    subtotal: null,
    tax: null,
    total: null,
    paid: 0,
    refunded: roundMajor(minorToMajor(refundedMinor, currency)),
    net: roundMajor(minorToMajor(-refundedMinor, currency)),
    status: accountingStatus(originalMinor, refundedMinor),
  };
}

function emptyIdentity(refund: RefundSnapshot): Omit<
  AccountingRow,
  | "paidAtUnix"
  | "paidAt"
  | "currency"
  | "subtotal"
  | "tax"
  | "total"
  | "paid"
  | "refunded"
  | "net"
  | "status"
> {
  return {
    salon: null,
    company: null,
    taxId: null,
    email: null,
    address: null,
    country: null,
    plan: null,
    periodLabel: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeInvoiceId: null,
    stripeInvoiceNumber: null,
    paymentId: [refund.paymentIntentId, refund.chargeId].filter(Boolean).join(" / ") || null,
  };
}

function paymentIdentity(
  charge: ChargeSnapshot,
  input: {
    links: ReturnType<typeof indexInvoicePayments>;
    invoicesById: Map<string, InvoiceSnapshot>;
    tenants: TenantMatch[];
    planLabelForPriceId: (priceId: string) => string | null;
  },
): {
  currency: string;
  invoice: InvoiceSnapshot | null;
  fields: Omit<
    AccountingRow,
    | "paidAtUnix"
    | "paidAt"
    | "currency"
    | "subtotal"
    | "tax"
    | "total"
    | "paid"
    | "refunded"
    | "net"
    | "status"
  >;
} {
  const paymentIntentId = idOf(charge.payment_intent);
  const linked =
    (paymentIntentId ? input.links.byPaymentIntent.get(paymentIntentId) : undefined) ??
    input.links.byCharge.get(charge.id) ??
    null;
  const invoiceId = idOf(linked?.invoice);
  const invoice = invoiceId ? (input.invoicesById.get(invoiceId) ?? null) : null;
  const customerId = idOf(charge.customer) ?? idOf(invoice?.customer);
  const subscriptionId = invoice?.subscriptionId ?? null;
  const tenant = matchTenant(input.tenants, customerId, subscriptionId);
  const line = pickInvoiceLine(invoice?.lines);
  const priceLabel = line?.priceId ? input.planLabelForPriceId(line.priceId) : null;
  const currency = (charge.currency || invoice?.currency || "").toUpperCase();
  const stripeTax = stripeTaxId(invoice);
  const companyFromTenant =
    tenant?.billingType === "company" ? blankToNull(tenant.billingName) : null;
  const company =
    (stripeTax ? blankToNull(invoice?.customer_name) : null) ?? companyFromTenant;

  return {
    currency,
    invoice,
    fields: {
      salon:
        blankToNull(tenant?.tenantName) ??
        blankToNull(invoice?.customer_name) ??
        blankToNull(invoice?.customer_email),
      company,
      taxId: stripeTax ?? blankToNull(tenant?.billingCui),
      email: blankToNull(invoice?.customer_email),
      address:
        formatStripeAddress(invoice?.customer_address) ?? formatTenantAddress(tenant),
      country:
        blankToNull(invoice?.customer_address?.country)?.toUpperCase() ??
        blankToNull(tenant?.country)?.toUpperCase() ??
        null,
      plan: priceLabel ?? blankToNull(line?.description),
      periodLabel:
        line?.period != null
          ? `${formatBucharestDate(line.period.start)} – ${formatBucharestDate(line.period.end)}`
          : null,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeInvoiceId: invoice?.id ?? invoiceId,
      stripeInvoiceNumber: blankToNull(invoice?.number),
      paymentId: [paymentIntentId, charge.id].filter(Boolean).join(" / ") || null,
    },
  };
}

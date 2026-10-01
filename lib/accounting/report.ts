import { getPlanSlugFromStripePriceId } from "@/lib/billing/stripePrices";
import {
  accountingStatus,
  minorToMajor,
  netMinor,
  succeededRefundMinor,
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
    current.paymentCount += 1;
    current.collected = roundMajor(current.collected + row.paid);
    current.refunded = roundMajor(current.refunded + row.refunded);
    current.net = roundMajor(current.net + row.net);
    byCurrency.set(row.currency, current);
  }
  return [...byCurrency.values()].sort((a, b) =>
    currencySort(a.currency, b.currency),
  );
}

export function buildAccountingReport(input: {
  charges: ChargeSnapshot[];
  invoicePayments: InvoicePaymentSnapshot[];
  invoices: InvoiceSnapshot[];
  tenants: TenantMatch[];
  period: AccountingPeriod;
  refundedMinorByChargeId?: Record<string, number>;
  generatedAt?: Date;
  planLabelForPriceId?: (priceId: string) => string | null;
}): AccountingReport {
  const planLabelForPriceId = input.planLabelForPriceId ?? defaultPlanLabel;
  const invoicesById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));
  const links = indexInvoicePayments(input.invoicePayments);
  const seen = new Set<string>();
  const rows: AccountingRow[] = [];

  const charges = [...input.charges].sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));

  for (const charge of charges) {
    if (!isCollectedCharge(charge)) continue;
    if (!isInAccountingPeriod(charge.created, input.period)) continue;
    if (seen.has(charge.id)) continue;
    seen.add(charge.id);

    const paymentIntentId = idOf(charge.payment_intent);
    const linked =
      (paymentIntentId ? links.byPaymentIntent.get(paymentIntentId) : undefined) ??
      links.byCharge.get(charge.id) ??
      null;
    const invoiceId = idOf(linked?.invoice);
    const invoice = invoiceId ? (invoicesById.get(invoiceId) ?? null) : null;
    const customerId = idOf(charge.customer) ?? idOf(invoice?.customer);
    const subscriptionId = invoice?.subscriptionId ?? null;
    const tenant = matchTenant(input.tenants, customerId, subscriptionId);
    const line = pickInvoiceLine(invoice?.lines);
    const priceLabel = line?.priceId ? planLabelForPriceId(line.priceId) : null;
    const currency = (charge.currency || invoice?.currency || "").toUpperCase();
    const paidMinor = charge.amount;
    const refundedMinor =
      input.refundedMinorByChargeId?.[charge.id] ?? succeededRefundMinor(charge);
    const taxMinor = taxMinorFromTotalTaxes(invoice?.total_taxes);
    const stripeTax = stripeTaxId(invoice);
    const companyFromTenant =
      tenant?.billingType === "company" ? blankToNull(tenant.billingName) : null;
    const company =
      (stripeTax ? blankToNull(invoice?.customer_name) : null) ??
      companyFromTenant;

    rows.push({
      paidAtUnix: charge.created,
      paidAt: formatBucharestDateTime(new Date(charge.created * 1000)),
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
      currency,
      subtotal:
        invoice?.subtotal == null
          ? null
          : roundMajor(minorToMajor(invoice.subtotal, currency)),
      tax:
        taxMinor == null ? null : roundMajor(minorToMajor(taxMinor, currency)),
      total:
        invoice?.total == null
          ? null
          : roundMajor(minorToMajor(invoice.total, currency)),
      paid: roundMajor(minorToMajor(paidMinor, currency)),
      refunded: roundMajor(minorToMajor(refundedMinor, currency)),
      net: roundMajor(minorToMajor(netMinor(paidMinor, refundedMinor), currency)),
      status: accountingStatus(paidMinor, refundedMinor),
    });
  }

  return {
    period: input.period,
    generatedAt: formatBucharestDateTime(input.generatedAt ?? new Date()),
    rows,
    totalsByCurrency: totalsByCurrency(rows),
    paymentCount: rows.length,
  };
}

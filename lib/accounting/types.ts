import type { AccountingStatus } from "@/lib/accounting/money";
import type { AccountingPeriod } from "@/lib/accounting/period";

export type { AccountingStatus };

export type ChargeSnapshot = {
  id: string;
  amount: number;
  amount_refunded?: number | null;
  currency: string;
  created: number;
  paid: boolean;
  status: string;
  customer: string | { id: string } | null;
  payment_intent: string | { id: string } | null;
  refunds?: {
    data?: Array<{ id?: string; amount: number; status: string | null }>;
    has_more?: boolean;
  } | null;
};

export type InvoicePaymentSnapshot = {
  id: string;
  status: string;
  amount_paid?: number | null;
  currency?: string | null;
  created: number;
  invoice: string | { id: string } | null;
  payment: {
    type: string;
    payment_intent?: string | { id: string } | null;
    charge?: string | { id: string } | null;
  };
  status_transitions?: { paid_at?: number | null };
};

export type InvoiceLineSnapshot = {
  description?: string | null;
  amount?: number | null;
  period?: { start: number; end: number } | null;
  priceId?: string | null;
};

export type InvoiceSnapshot = {
  id: string;
  number?: string | null;
  status?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  total?: number | null;
  amount_paid?: number | null;
  customer?: string | { id: string } | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  customer_tax_ids?: Array<{ type: string; value: string | null }> | null;
  total_taxes?: Array<{ amount: number }> | null;
  subscriptionId?: string | null;
  lines?: InvoiceLineSnapshot[];
  linesHasMore?: boolean;
};

export type TenantMatch = {
  tenantId: string;
  tenantName: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingType: string | null;
  billingName: string | null;
  billingCui: string | null;
  addressLine1: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  country: string | null;
};

export type AccountingRow = {
  paidAtUnix: number;
  paidAt: string;
  salon: string | null;
  company: string | null;
  taxId: string | null;
  email: string | null;
  address: string | null;
  country: string | null;
  plan: string | null;
  periodLabel: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  stripeInvoiceNumber: string | null;
  paymentId: string | null;
  currency: string;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  paid: number;
  refunded: number;
  net: number;
  status: AccountingStatus;
};

export type CurrencyTotals = {
  currency: string;
  paymentCount: number;
  collected: number;
  refunded: number;
  net: number;
};

export type AccountingReport = {
  period: AccountingPeriod;
  generatedAt: string;
  rows: AccountingRow[];
  totalsByCurrency: CurrencyTotals[];
  paymentCount: number;
};

export type StripeList<T> = {
  data: T[];
  has_more: boolean;
};

export type StripeAccountingClient = {
  charges: {
    list(params: {
      limit: number;
      starting_after?: string;
      created: { gte: number; lt: number };
      expand?: string[];
    }): Promise<StripeList<ChargeSnapshot>>;
  };
  invoicePayments: {
    list(params: {
      limit: number;
      starting_after?: string;
      status?: "paid";
      created?: { gte: number; lt: number };
      payment?: { type: "payment_intent"; payment_intent: string };
    }): Promise<StripeList<InvoicePaymentSnapshot>>;
  };
  invoices: {
    list(params: {
      limit: number;
      starting_after?: string;
      status: "paid";
      created: { gte: number; lt: number };
    }): Promise<StripeList<InvoiceSnapshot>>;
    retrieve(id: string): Promise<InvoiceSnapshot>;
    listLineItems(
      id: string,
      params: { limit: number; starting_after?: string },
    ): Promise<StripeList<InvoiceLineSnapshot & { id: string }>>;
  };
  refunds: {
    list(params: {
      limit: number;
      starting_after?: string;
      charge: string;
    }): Promise<StripeList<{ id: string; amount: number; status: string | null }>>;
  };
};

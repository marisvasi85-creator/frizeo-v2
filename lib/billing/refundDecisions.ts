export const FRIZEO_REFUND_FLOW_KEY = "frizeo_refund_flow";
export const FRIZEO_REFUND_FLOW_FULL_CANCEL = "full_cancel";
export const REFUND_IN_PROGRESS_MS = 20_000;

const SUBSCRIPTION_BILLING_REASONS = new Set([
  "subscription",
  "subscription_create",
  "subscription_cycle",
  "subscription_update",
  "subscription_threshold",
]);

export type InvoiceCandidate = {
  id: string;
  status: string | null;
  amountPaid: number;
  currency: string;
  billingReason: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  paidAt: number | null;
  created: number;
};

export type PaymentFacts = {
  paymentIntentId: string | null;
  chargeId: string | null;
  amount: number;
  amountRefunded: number;
  fullyRefunded: boolean;
  currency: string;
};

export type Refundability =
  | { state: "refundable"; amount: number }
  | {
      state:
        | "missing_payment"
        | "unpaid"
        | "already_refunded"
        | "partially_refunded"
        | "amount_mismatch"
        | "action_required";
    };

export type OpenAudit = {
  id: string;
  status: string;
  stripeRefundId: string | null;
  createdAtMs: number;
};

export type AdminRefundPlan =
  | {
      type: "stop";
      code:
        | "no_subscription"
        | "stripe_subscription_missing"
        | "chain_mismatch"
        | "no_eligible_invoice"
        | "unpaid"
        | "missing_payment"
        | "partially_refunded"
        | "amount_mismatch"
        | "action_required"
        | "already_refunded"
        | "in_progress"
        | "refund_pending"
        | "reconciled";
    }
  | { type: "create_refund"; amount: number; auditId: string | null }
  | {
      type: "resume";
      auditId: string;
      phase: "cancel_and_downgrade" | "downgrade_only";
    };

export function refundIdempotencyKey(invoiceId: string): string {
  return `frizeo-full-refund:${invoiceId}`;
}

export function selectLatestPaidSubscriptionInvoice(
  invoices: InvoiceCandidate[],
  expected: { customerId: string; subscriptionId: string },
): InvoiceCandidate | null {
  const eligible = invoices.filter((invoice) => {
    if (invoice.status !== "paid" || invoice.amountPaid <= 0) return false;
    if (
      !invoice.billingReason ||
      !SUBSCRIPTION_BILLING_REASONS.has(invoice.billingReason)
    ) {
      return false;
    }
    if (invoice.customerId !== expected.customerId) return false;
    if (invoice.subscriptionId !== expected.subscriptionId) return false;
    return true;
  });

  eligible.sort((a, b) => (b.paidAt ?? b.created) - (a.paidAt ?? a.created));
  return eligible[0] ?? null;
}

export function assessRefundability(
  invoiceAmountPaid: number,
  payment: PaymentFacts | null,
  options?: { actionRequired?: boolean },
): Refundability {
  if (options?.actionRequired) return { state: "action_required" };
  if (!payment || (!payment.paymentIntentId && !payment.chargeId)) {
    return { state: "missing_payment" };
  }
  if (invoiceAmountPaid <= 0 || payment.amount <= 0) {
    return { state: "unpaid" };
  }
  if (payment.fullyRefunded || payment.amountRefunded >= payment.amount) {
    return { state: "already_refunded" };
  }
  if (payment.amountRefunded > 0) {
    return { state: "partially_refunded" };
  }
  if (payment.amount !== invoiceAmountPaid) {
    return { state: "amount_mismatch" };
  }
  return { state: "refundable", amount: invoiceAmountPaid };
}

export function subscriptionChainMatches(input: {
  localCustomerId: string | null;
  localSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  invoiceCustomerId: string | null;
  invoiceSubscriptionId: string | null;
}): boolean {
  if (!input.localCustomerId || !input.localSubscriptionId) return false;
  if (!input.stripeCustomerId || !input.stripeSubscriptionId) return false;
  if (input.localCustomerId !== input.stripeCustomerId) return false;
  if (input.localSubscriptionId !== input.stripeSubscriptionId) return false;
  if (input.invoiceCustomerId !== input.localCustomerId) return false;
  if (input.invoiceSubscriptionId !== input.localSubscriptionId) return false;
  return true;
}

/**
 * After downgrade, stripe_subscription_id is cleared but the customer id stays.
 * Webhook retries must still recognize the tenant without issuing another refund.
 */
export function observedTenantMatches(input: {
  tenantId: string;
  metadataTenantId: string | null;
  localCustomerId: string | null;
  localSubscriptionId: string | null;
  invoiceCustomerId: string | null;
  invoiceSubscriptionId: string | null;
}): boolean {
  if (input.metadataTenantId && input.metadataTenantId !== input.tenantId) {
    return false;
  }
  if (
    !input.localCustomerId ||
    input.localCustomerId !== input.invoiceCustomerId
  ) {
    return false;
  }
  if (
    input.localSubscriptionId &&
    input.invoiceSubscriptionId &&
    input.localSubscriptionId !== input.invoiceSubscriptionId
  ) {
    return false;
  }
  return Boolean(input.invoiceSubscriptionId);
}

export function isFullRefund(input: {
  refundAmount: number;
  invoiceAmountPaid: number;
  chargeAmount: number | null;
  amountRefunded: number | null;
  fullyRefunded: boolean | null;
}): boolean {
  if (input.fullyRefunded) return true;
  if (
    input.chargeAmount != null &&
    input.chargeAmount > 0 &&
    input.amountRefunded != null &&
    input.amountRefunded >= input.chargeAmount
  ) {
    return true;
  }
  if (
    input.invoiceAmountPaid > 0 &&
    input.refundAmount >= input.invoiceAmountPaid &&
    (input.amountRefunded == null ||
      input.amountRefunded === 0 ||
      input.amountRefunded >= input.invoiceAmountPaid)
  ) {
    return true;
  }
  return false;
}

export function classifyObservedRefund(input: {
  refundStatus: string | null;
  refundAmount: number;
  invoiceAmountPaid: number;
  chargeAmount: number | null;
  amountRefunded: number | null;
  fullyRefunded: boolean | null;
  metadata: Record<string, string> | null;
}): {
  disposition: "ignore" | "partial" | "full";
  frizeoFullCancel: boolean;
} {
  const status = input.refundStatus;
  if (
    status === "pending" ||
    status === "failed" ||
    status === "canceled" ||
    status === "requires_action"
  ) {
    return { disposition: "ignore", frizeoFullCancel: false };
  }

  const full = isFullRefund(input);
  const frizeoFullCancel =
    full &&
    input.metadata?.[FRIZEO_REFUND_FLOW_KEY] === FRIZEO_REFUND_FLOW_FULL_CANCEL;

  return {
    disposition: full ? "full" : "partial",
    frizeoFullCancel,
  };
}

export function planAdminRefund(input: {
  hasLocalSubscription: boolean;
  stripeSubscriptionFound: boolean;
  /** Local Stripe customer/subscription matches the Stripe subscription object. */
  linkOk: boolean;
  chainOk: boolean;
  invoice: InvoiceCandidate | null;
  refundability: Refundability;
  audit: OpenAudit | null;
  nowMs: number;
}): AdminRefundPlan {
  if (!input.hasLocalSubscription) return { type: "stop", code: "no_subscription" };
  if (!input.stripeSubscriptionFound) {
    return { type: "stop", code: "stripe_subscription_missing" };
  }
  if (!input.linkOk) return { type: "stop", code: "chain_mismatch" };
  if (!input.invoice) return { type: "stop", code: "no_eligible_invoice" };
  if (!input.chainOk) return { type: "stop", code: "chain_mismatch" };

  const audit = input.audit;
  if (audit?.status === "observed_partial") {
    return { type: "stop", code: "partially_refunded" };
  }
  if (audit?.status === "observed_full") {
    return { type: "stop", code: "already_refunded" };
  }
  if (audit?.status === "reconciled") {
    return { type: "stop", code: "reconciled" };
  }
  if (audit?.status === "action_required") {
    return { type: "stop", code: "action_required" };
  }
  if (audit?.status === "pending" && audit.stripeRefundId) {
    return { type: "stop", code: "refund_pending" };
  }
  if (audit?.status === "downgrade_failed") {
    return { type: "resume", auditId: audit.id, phase: "downgrade_only" };
  }
  if (
    audit &&
    (audit.status === "refunded" || audit.status === "cancel_failed")
  ) {
    return {
      type: "resume",
      auditId: audit.id,
      phase: "cancel_and_downgrade",
    };
  }

  if (input.refundability.state === "already_refunded") {
    return { type: "stop", code: "already_refunded" };
  }
  if (input.refundability.state !== "refundable") {
    return { type: "stop", code: input.refundability.state };
  }

  if (audit?.status === "pending" && !audit.stripeRefundId) {
    if (input.nowMs - audit.createdAtMs < REFUND_IN_PROGRESS_MS) {
      return { type: "stop", code: "in_progress" };
    }
    return {
      type: "create_refund",
      amount: input.refundability.amount,
      auditId: audit.id,
    };
  }

  return {
    type: "create_refund",
    amount: input.refundability.amount,
    auditId: null,
  };
}

export function refundFlowMetadata(input: {
  tenantId: string;
  invoiceId: string;
}): Record<string, string> {
  return {
    [FRIZEO_REFUND_FLOW_KEY]: FRIZEO_REFUND_FLOW_FULL_CANCEL,
    tenant_id: input.tenantId,
    stripe_invoice_id: input.invoiceId,
  };
}

export const REFUND_MESSAGES: Record<string, string> = {
  no_subscription: "Acest salon nu are un abonament Stripe.",
  stripe_subscription_missing:
    "Abonamentul Stripe nu mai există. Nu am emis refund.",
  chain_mismatch:
    "Factura nu aparține abonamentului acestui salon. Refund oprit.",
  no_eligible_invoice: "Nu există o factură de abonament plătită, eligibilă pentru refund.",
  unpaid: "Ultima factură nu este plătită.",
  missing_payment: "Factura plătită nu are o plată Stripe identificabilă.",
  partially_refunded:
    "Plata are deja un refund parțial. Nu emitem încă un refund și nu schimbăm planul.",
  amount_mismatch:
    "Suma încasată nu corespunde facturii. Refund oprit pentru verificare manuală.",
  action_required:
    "Există un refund care așteaptă o acțiune în Stripe. Nu am emis alt refund.",
  already_refunded: "Plata este deja returnată integral. Nu am mai emis un refund.",
  in_progress: "Un refund pentru această factură este deja în curs.",
  refund_pending:
    "Refund-ul este în procesare la Stripe. Abonamentul rămâne neschimbat până când refund-ul este confirmat.",
  reconciled: "Refund-ul acestui salon este deja finalizat.",
  cancel_failed:
    "Banii au fost returnați în Stripe, dar anularea abonamentului a eșuat. Poți reîncerca; nu se va emite un al doilea refund.",
  downgrade_failed:
    "Refund-ul și anularea au reușit, dar trecerea pe Free a eșuat. Reîncearcă; webhook-ul sau retry-ul reconciliază fără un refund nou.",
  stripe_error: "Stripe nu a putut finaliza refund-ul. Nu am anulat abonamentul.",
  stripe_refund_failed: "Stripe a marcat refund-ul ca eșuat. Abonamentul a rămas neschimbat.",
  invalid_input: "Cerere invalidă.",
  confirm_required: "Confirmă explicit refund-ul înainte de a continua.",
};

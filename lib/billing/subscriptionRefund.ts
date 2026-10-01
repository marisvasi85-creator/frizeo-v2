import {
  assessRefundability,
  classifyObservedRefund,
  observedTenantMatches,
  planAdminRefund,
  refundFlowMetadata,
  refundIdempotencyKey,
  selectLatestPaidSubscriptionInvoice,
  subscriptionChainMatches,
  type InvoiceCandidate,
  type OpenAudit,
  type PaymentFacts,
} from "@/lib/billing/refundDecisions";

export type LocalSubscription = {
  tenantId: string;
  tenantName: string | null;
  tenantSlug: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string | null;
  planSlug: string | null;
  planName: string | null;
};

export type AuditInsert = {
  tenantId: string;
  initiatedByUserId: string | null;
  initiatedByEmail: string | null;
  source: "admin_api" | "stripe_webhook";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeRefundId: string | null;
  amount: number | null;
  currency: string | null;
  refundKind: "full" | "partial";
  status: string;
  reconciliationStatus: string | null;
  errorMessage: string | null;
  idempotencyKey: string | null;
};

export type AuditPatch = Partial<
  Pick<
    AuditInsert,
    | "status"
    | "stripeRefundId"
    | "stripePaymentIntentId"
    | "stripeChargeId"
    | "amount"
    | "currency"
    | "reconciliationStatus"
    | "errorMessage"
    | "refundKind"
  >
>;

export type CreatedRefund = {
  id: string;
  status: string | null;
  amount: number;
};

export type ListedRefund = {
  id: string;
  amount: number;
  status: string | null;
  metadata: Record<string, string> | null;
};

export type AdminRefundDeps = {
  now: () => number;
  loadLocal: (tenantId: string) => Promise<LocalSubscription | null>;
  loadStripeSubscription: (
    subscriptionId: string,
  ) => Promise<{ id: string; customerId: string | null; status: string } | null>;
  listInvoices: (subscriptionId: string) => Promise<InvoiceCandidate[]>;
  resolvePayment: (invoiceId: string) => Promise<{
    payment: PaymentFacts | null;
    actionRequired: boolean;
  }>;
  createRefund: (input: {
    paymentIntentId: string | null;
    chargeId: string | null;
    amount: number;
    currency: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }) => Promise<CreatedRefund>;
  listRefunds: (input: {
    paymentIntentId: string | null;
    chargeId: string | null;
  }) => Promise<ListedRefund[]>;
  cancelSubscription: (subscriptionId: string) => Promise<void>;
  downgradeTenant: (tenantId: string) => Promise<void>;
  findOpenFullByInvoice: (invoiceId: string) => Promise<OpenAudit | null>;
  insertAudit: (
    row: AuditInsert,
  ) => Promise<{ ok: true; id: string; createdAtMs: number } | { ok: false; conflict: true }>;
  updateAudit: (id: string, patch: AuditPatch) => Promise<void>;
  isAlreadyRefundedError: (err: unknown) => boolean;
  isInProgressError: (err: unknown) => boolean;
};

export type AdminRefundOutcome =
  | {
      ok: true;
      code: "reconciled" | "already_reconciled";
      refundId: string | null;
      invoiceId: string | null;
      amount: number | null;
      currency: string | null;
    }
  | {
      ok: false;
      code: string;
      retryable: boolean;
      refundId: string | null;
      invoiceId: string | null;
    };

export type RefundInspection = {
  local: LocalSubscription | null;
  stripeStatus: string | null;
  invoice: InvoiceCandidate | null;
  payment: PaymentFacts | null;
  audit: OpenAudit | null;
  plan: ReturnType<typeof planAdminRefund>;
};

const RETRYABLE = new Set([
  "in_progress",
  "refund_pending",
  "cancel_failed",
  "downgrade_failed",
  "stripe_error",
  "stripe_refund_failed",
]);

function stop(
  code: string,
  extra?: { refundId?: string | null; invoiceId?: string | null },
): AdminRefundOutcome {
  if (code === "reconciled") {
    return {
      ok: true,
      code: "already_reconciled",
      refundId: extra?.refundId ?? null,
      invoiceId: extra?.invoiceId ?? null,
      amount: null,
      currency: null,
    };
  }
  return {
    ok: false,
    code,
    retryable: RETRYABLE.has(code),
    refundId: extra?.refundId ?? null,
    invoiceId: extra?.invoiceId ?? null,
  };
}

export async function inspectTenantRefund(
  deps: Pick<
    AdminRefundDeps,
    | "now"
    | "loadLocal"
    | "loadStripeSubscription"
    | "listInvoices"
    | "resolvePayment"
    | "findOpenFullByInvoice"
  >,
  tenantId: string,
): Promise<RefundInspection> {
  const local = await deps.loadLocal(tenantId);
  const nowMs = deps.now();
  if (!local?.stripeSubscriptionId || !local.stripeCustomerId) {
    return {
      local,
      stripeStatus: null,
      invoice: null,
      payment: null,
      audit: null,
      plan: planAdminRefund({
        hasLocalSubscription: false,
        stripeSubscriptionFound: false,
        linkOk: false,
        chainOk: false,
        invoice: null,
        refundability: { state: "missing_payment" },
        audit: null,
        nowMs,
      }),
    };
  }

  const stripeSub = await deps.loadStripeSubscription(local.stripeSubscriptionId);
  if (!stripeSub) {
    return {
      local,
      stripeStatus: null,
      invoice: null,
      payment: null,
      audit: null,
      plan: planAdminRefund({
        hasLocalSubscription: true,
        stripeSubscriptionFound: false,
        linkOk: false,
        chainOk: false,
        invoice: null,
        refundability: { state: "missing_payment" },
        audit: null,
        nowMs,
      }),
    };
  }

  const linkOk =
    stripeSub.customerId === local.stripeCustomerId &&
    stripeSub.id === local.stripeSubscriptionId;
  const invoices = linkOk
    ? await deps.listInvoices(local.stripeSubscriptionId)
    : [];
  const invoice = linkOk
    ? selectLatestPaidSubscriptionInvoice(invoices, {
        customerId: local.stripeCustomerId,
        subscriptionId: local.stripeSubscriptionId,
      })
    : null;
  const resolved = invoice ? await deps.resolvePayment(invoice.id) : null;
  const payment = resolved?.payment ?? null;
  const refundability = invoice
    ? assessRefundability(invoice.amountPaid, payment, {
        actionRequired: resolved?.actionRequired,
      })
    : ({ state: "missing_payment" } as const);
  const chainOk = invoice
    ? subscriptionChainMatches({
        localCustomerId: local.stripeCustomerId,
        localSubscriptionId: local.stripeSubscriptionId,
        stripeCustomerId: stripeSub.customerId,
        stripeSubscriptionId: stripeSub.id,
        invoiceCustomerId: invoice.customerId,
        invoiceSubscriptionId: invoice.subscriptionId,
      })
    : false;
  const audit = invoice ? await deps.findOpenFullByInvoice(invoice.id) : null;

  return {
    local,
    stripeStatus: stripeSub.status,
    invoice,
    payment,
    audit,
    plan: planAdminRefund({
      hasLocalSubscription: true,
      stripeSubscriptionFound: true,
      linkOk,
      chainOk,
      invoice,
      refundability,
      audit,
      nowMs,
    }),
  };
}

async function finishAfterRefund(
  deps: AdminRefundDeps,
  input: {
    tenantId: string;
    subscriptionId: string;
    auditId: string;
    phase: "cancel_and_downgrade" | "downgrade_only";
    refundId: string | null;
    invoiceId: string;
    amount: number | null;
    currency: string | null;
  },
): Promise<AdminRefundOutcome> {
  if (input.phase === "cancel_and_downgrade") {
    try {
      await deps.cancelSubscription(input.subscriptionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "cancel_failed";
      await deps.updateAudit(input.auditId, {
        status: "cancel_failed",
        stripeRefundId: input.refundId,
        reconciliationStatus: "refunded_cancel_pending",
        errorMessage: message.slice(0, 500),
      });
      return stop("cancel_failed", {
        refundId: input.refundId,
        invoiceId: input.invoiceId,
      });
    }
  }

  try {
    await deps.downgradeTenant(input.tenantId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "downgrade_failed";
    await deps.updateAudit(input.auditId, {
      status: "downgrade_failed",
      stripeRefundId: input.refundId,
      reconciliationStatus: "canceled_downgrade_pending",
      errorMessage: message.slice(0, 500),
    });
    return stop("downgrade_failed", {
      refundId: input.refundId,
      invoiceId: input.invoiceId,
    });
  }

  await deps.updateAudit(input.auditId, {
    status: "reconciled",
    stripeRefundId: input.refundId,
    reconciliationStatus: "refunded_canceled_free",
    errorMessage: null,
  });

  return {
    ok: true,
    code: "reconciled",
    refundId: input.refundId,
    invoiceId: input.invoiceId,
    amount: input.amount,
    currency: input.currency,
  };
}

export async function executeAdminRefund(
  deps: AdminRefundDeps,
  input: { tenantId: string; actorUserId: string; actorEmail: string },
): Promise<AdminRefundOutcome> {
  const first = await inspectTenantRefund(deps, input.tenantId);
  return continueFromInspection(deps, input, first, false);
}

async function continueFromInspection(
  deps: AdminRefundDeps,
  input: { tenantId: string; actorUserId: string; actorEmail: string },
  inspection: RefundInspection,
  afterConflict: boolean,
): Promise<AdminRefundOutcome> {
  const { plan, local, invoice, payment } = inspection;
  if (plan.type === "stop") {
    return stop(plan.code, {
      refundId: inspection.audit?.stripeRefundId ?? null,
      invoiceId: invoice?.id ?? null,
    });
  }

  if (!local?.stripeSubscriptionId || !invoice || !payment) {
    return stop("no_eligible_invoice");
  }

  if (plan.type === "resume") {
    return finishAfterRefund(deps, {
      tenantId: input.tenantId,
      subscriptionId: local.stripeSubscriptionId,
      auditId: plan.auditId,
      phase: plan.phase,
      refundId: inspection.audit?.stripeRefundId ?? null,
      invoiceId: invoice.id,
      amount: invoice.amountPaid,
      currency: invoice.currency,
    });
  }

  let auditId = plan.auditId;
  if (!auditId) {
    const inserted = await deps.insertAudit({
      tenantId: input.tenantId,
      initiatedByUserId: input.actorUserId,
      initiatedByEmail: input.actorEmail,
      source: "admin_api",
      stripeCustomerId: local.stripeCustomerId,
      stripeSubscriptionId: local.stripeSubscriptionId,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: payment.paymentIntentId,
      stripeChargeId: payment.chargeId,
      stripeRefundId: null,
      amount: plan.amount,
      currency: invoice.currency,
      refundKind: "full",
      status: "pending",
      reconciliationStatus: "pending_stripe_refund",
      errorMessage: null,
      idempotencyKey: refundIdempotencyKey(invoice.id),
    });
    if (!inserted.ok) {
      if (afterConflict) return stop("in_progress", { invoiceId: invoice.id });
      const again = await inspectTenantRefund(deps, input.tenantId);
      return continueFromInspection(deps, input, again, true);
    }
    auditId = inserted.id;
  }

  const metadata = refundFlowMetadata({
    tenantId: input.tenantId,
    invoiceId: invoice.id,
  });

  let created: CreatedRefund;
  try {
    created = await deps.createRefund({
      paymentIntentId: payment.paymentIntentId,
      chargeId: payment.chargeId,
      amount: plan.amount,
      currency: invoice.currency,
      idempotencyKey: refundIdempotencyKey(invoice.id),
      metadata,
    });
  } catch (err) {
    if (deps.isInProgressError(err)) {
      return stop("in_progress", { invoiceId: invoice.id });
    }
    if (deps.isAlreadyRefundedError(err)) {
      const existing = await deps.listRefunds({
        paymentIntentId: payment.paymentIntentId,
        chargeId: payment.chargeId,
      });
      const prior = existing.find(
        (refund) =>
          refund.status === "succeeded" || refund.status === "pending",
      );
      if (prior?.status === "succeeded") {
        await deps.updateAudit(auditId, {
          status: "refunded",
          stripeRefundId: prior.id,
          amount: prior.amount,
          reconciliationStatus: "stripe_already_refunded",
          errorMessage: null,
        });
        return finishAfterRefund(deps, {
          tenantId: input.tenantId,
          subscriptionId: local.stripeSubscriptionId,
          auditId,
          phase: "cancel_and_downgrade",
          refundId: prior.id,
          invoiceId: invoice.id,
          amount: prior.amount,
          currency: invoice.currency,
        });
      }
      if (prior?.status === "pending") {
        await deps.updateAudit(auditId, {
          status: "pending",
          stripeRefundId: prior.id,
          amount: prior.amount,
          reconciliationStatus: "refund_processing",
          errorMessage: null,
        });
        return stop("refund_pending", {
          refundId: prior.id,
          invoiceId: invoice.id,
        });
      }
    }

    const message = err instanceof Error ? err.message : "stripe_error";
    await deps.updateAudit(auditId, {
      reconciliationStatus: "stripe_call_failed",
      errorMessage: message.slice(0, 500),
    });
    return stop("stripe_error", { invoiceId: invoice.id });
  }

  if (created.status === "failed" || created.status === "canceled") {
    await deps.updateAudit(auditId, {
      status: "failed",
      stripeRefundId: created.id,
      reconciliationStatus: "stripe_refund_failed",
      errorMessage: created.status,
    });
    return stop("stripe_refund_failed", {
      refundId: created.id,
      invoiceId: invoice.id,
    });
  }

  if (created.status === "requires_action") {
    await deps.updateAudit(auditId, {
      status: "action_required",
      stripeRefundId: created.id,
      amount: created.amount,
      reconciliationStatus: "requires_action",
      errorMessage: null,
    });
    return stop("action_required", {
      refundId: created.id,
      invoiceId: invoice.id,
    });
  }

  if (created.status !== "succeeded") {
    await deps.updateAudit(auditId, {
      status: "pending",
      stripeRefundId: created.id,
      amount: created.amount,
      reconciliationStatus: "refund_processing",
      errorMessage: null,
    });
    return stop("refund_pending", {
      refundId: created.id,
      invoiceId: invoice.id,
    });
  }

  await deps.updateAudit(auditId, {
    status: "refunded",
    stripeRefundId: created.id,
    amount: created.amount,
    reconciliationStatus: "refunded_cancel_pending",
    errorMessage: null,
  });

  return finishAfterRefund(deps, {
    tenantId: input.tenantId,
    subscriptionId: local.stripeSubscriptionId,
    auditId,
    phase: "cancel_and_downgrade",
    refundId: created.id,
    invoiceId: invoice.id,
    amount: created.amount,
    currency: invoice.currency,
  });
}

export type ObservedRefundDeps = {
  now: () => number;
  loadLocalBySubscription: (
    subscriptionId: string,
  ) => Promise<LocalSubscription | null>;
  loadLocalByCustomer: (customerId: string) => Promise<LocalSubscription | null>;
  loadLocalByTenant: (tenantId: string) => Promise<LocalSubscription | null>;
  findByRefundId: (refundId: string) => Promise<OpenAudit | null>;
  findOpenFullByInvoice: (invoiceId: string) => Promise<OpenAudit | null>;
  insertAudit: AdminRefundDeps["insertAudit"];
  updateAudit: AdminRefundDeps["updateAudit"];
  cancelSubscription: (subscriptionId: string) => Promise<void>;
  downgradeTenant: (tenantId: string) => Promise<void>;
  syncSubscription: (subscriptionId: string) => Promise<void>;
};

export type ObservedRefundInput = {
  refundId: string;
  refundStatus: string | null;
  refundAmount: number;
  currency: string;
  paymentIntentId: string | null;
  chargeId: string | null;
  metadata: Record<string, string> | null;
  invoice: InvoiceCandidate | null;
  payment: PaymentFacts | null;
  stripeSubscriptionStatus: string | null;
};

export type ObservedRefundOutcome = {
  action:
    | "ignored"
    | "logged_partial"
    | "synced_dashboard_refund"
    | "reconciled"
    | "idempotent"
    | "refund_pending"
    | "flagged_failure_after_accept"
    | "cancel_failed"
    | "downgrade_failed";
  reason?: string;
};

function refundFailed(status: string | null): boolean {
  return status === "failed" || status === "canceled";
}

export async function applyObservedRefund(
  deps: ObservedRefundDeps,
  input: ObservedRefundInput,
): Promise<ObservedRefundOutcome> {
  const metadataTenantId = input.metadata?.tenant_id?.trim() || null;
  const invoice = input.invoice;
  if (!invoice?.subscriptionId || !invoice.customerId) {
    return { action: "ignored", reason: "unlinked" };
  }

  const local =
    (await deps.loadLocalBySubscription(invoice.subscriptionId)) ||
    (metadataTenantId ? await deps.loadLocalByTenant(metadataTenantId) : null) ||
    (await deps.loadLocalByCustomer(invoice.customerId));

  if (
    !local ||
    !observedTenantMatches({
      tenantId: local.tenantId,
      metadataTenantId,
      localCustomerId: local.stripeCustomerId,
      localSubscriptionId: local.stripeSubscriptionId,
      invoiceCustomerId: invoice.customerId,
      invoiceSubscriptionId: invoice.subscriptionId,
    })
  ) {
    return { action: "ignored", reason: "tenant_mismatch" };
  }

  const existing =
    (await deps.findByRefundId(input.refundId)) ||
    (await deps.findOpenFullByInvoice(invoice.id));

  if (refundFailed(input.refundStatus) || input.refundStatus === "requires_action") {
    if (
      existing &&
      ["refunded", "cancel_failed", "downgrade_failed", "reconciled"].includes(
        existing.status,
      )
    ) {
      await deps.updateAudit(existing.id, {
        reconciliationStatus: "refund_failed_after_accept",
        errorMessage: input.refundStatus,
      });
      return { action: "flagged_failure_after_accept" };
    }
    if (existing && existing.status === "pending") {
      await deps.updateAudit(existing.id, {
        status: "failed",
        stripeRefundId: input.refundId,
        errorMessage: input.refundStatus,
        reconciliationStatus: "stripe_refund_failed",
      });
    }
    return { action: "ignored", reason: "refund_not_successful" };
  }

  if (input.refundStatus === "pending") {
    if (
      existing &&
      ["refunded", "cancel_failed", "downgrade_failed", "reconciled"].includes(
        existing.status,
      )
    ) {
      return { action: "idempotent" };
    }
    if (existing) {
      await deps.updateAudit(existing.id, {
        status: "pending",
        stripeRefundId: input.refundId,
        amount: input.refundAmount,
        currency: input.currency,
        reconciliationStatus: "refund_processing",
        errorMessage: null,
      });
      return { action: "refund_pending" };
    }
    const inserted = await deps.insertAudit({
      tenantId: local.tenantId,
      initiatedByUserId: null,
      initiatedByEmail: null,
      source: "stripe_webhook",
      stripeCustomerId: invoice.customerId,
      stripeSubscriptionId: invoice.subscriptionId,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: input.paymentIntentId,
      stripeChargeId: input.chargeId,
      stripeRefundId: input.refundId,
      amount: input.refundAmount,
      currency: input.currency,
      refundKind: "full",
      status: "pending",
      reconciliationStatus: "refund_processing",
      errorMessage: null,
      idempotencyKey: refundIdempotencyKey(invoice.id),
    });
    if (!inserted.ok) return { action: "idempotent" };
    return { action: "refund_pending" };
  }

  const classification = classifyObservedRefund({
    refundStatus: input.refundStatus,
    refundAmount: input.refundAmount,
    invoiceAmountPaid: invoice.amountPaid,
    chargeAmount: input.payment?.amount ?? null,
    amountRefunded: input.payment?.amountRefunded ?? null,
    fullyRefunded: input.payment?.fullyRefunded ?? null,
    metadata: input.metadata,
  });

  if (classification.disposition === "partial") {
    if (existing?.status === "observed_partial") {
      return { action: "idempotent" };
    }
    if (!existing) {
      const inserted = await deps.insertAudit({
        tenantId: local.tenantId,
        initiatedByUserId: null,
        initiatedByEmail: null,
        source: "stripe_webhook",
        stripeCustomerId: invoice.customerId,
        stripeSubscriptionId: invoice.subscriptionId,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: input.paymentIntentId,
        stripeChargeId: input.chargeId,
        stripeRefundId: input.refundId,
        amount: input.refundAmount,
        currency: input.currency,
        refundKind: "partial",
        status: "observed_partial",
        reconciliationStatus: "partial_no_downgrade",
        errorMessage: null,
        idempotencyKey: null,
      });
      if (!inserted.ok) return { action: "idempotent" };
    } else if (existing.stripeRefundId === input.refundId) {
      return { action: "idempotent" };
    }
    return { action: "logged_partial" };
  }

  if (!classification.frizeoFullCancel) {
    const adminOwns =
      existing != null &&
      [
        "refunded",
        "cancel_failed",
        "downgrade_failed",
        "reconciled",
        "action_required",
      ].includes(existing.status);
    if (adminOwns) {
      return { action: "idempotent", reason: "admin_flow_owns_invoice" };
    }
    if (!existing) {
      const inserted = await deps.insertAudit({
        tenantId: local.tenantId,
        initiatedByUserId: null,
        initiatedByEmail: null,
        source: "stripe_webhook",
        stripeCustomerId: invoice.customerId,
        stripeSubscriptionId: invoice.subscriptionId,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: input.paymentIntentId,
        stripeChargeId: input.chargeId,
        stripeRefundId: input.refundId,
        amount: input.refundAmount,
        currency: input.currency,
        refundKind: "full",
        status: "observed_full",
        reconciliationStatus: "dashboard_full_refund_no_auto_cancel",
        errorMessage: null,
        idempotencyKey: null,
      });
      if (!inserted.ok) return { action: "idempotent" };
    }
    await deps.syncSubscription(invoice.subscriptionId);
    return { action: "synced_dashboard_refund" };
  }

  if (existing?.status === "reconciled") {
    return { action: "idempotent" };
  }

  let auditId = existing?.id ?? null;
  if (!auditId) {
    const inserted = await deps.insertAudit({
      tenantId: local.tenantId,
      initiatedByUserId: null,
      initiatedByEmail: null,
      source: "stripe_webhook",
      stripeCustomerId: invoice.customerId,
      stripeSubscriptionId: invoice.subscriptionId,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: input.paymentIntentId,
      stripeChargeId: input.chargeId,
      stripeRefundId: input.refundId,
      amount: input.refundAmount,
      currency: input.currency,
      refundKind: "full",
      status: "refunded",
      reconciliationStatus: "webhook_refund_cancel_pending",
      errorMessage: null,
      idempotencyKey: refundIdempotencyKey(invoice.id),
    });
    if (!inserted.ok) {
      const raced = await deps.findOpenFullByInvoice(invoice.id);
      if (raced?.status === "reconciled") return { action: "idempotent" };
      auditId = raced?.id ?? null;
    } else {
      auditId = inserted.id;
    }
  }

  if (!auditId) return { action: "ignored", reason: "audit_race" };

  await deps.updateAudit(auditId, {
    status: existing?.status === "downgrade_failed" ? "downgrade_failed" : "refunded",
    stripeRefundId: input.refundId,
    amount: input.refundAmount,
    currency: input.currency,
  });

  const phase =
    existing?.status === "downgrade_failed"
      ? "downgrade_only"
      : "cancel_and_downgrade";

  if (phase === "cancel_and_downgrade") {
    const alreadyCanceled =
      input.stripeSubscriptionStatus === "canceled" ||
      input.stripeSubscriptionStatus === "incomplete_expired";
    if (!alreadyCanceled) {
      try {
        await deps.cancelSubscription(invoice.subscriptionId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "cancel_failed";
        await deps.updateAudit(auditId, {
          status: "cancel_failed",
          reconciliationStatus: "refunded_cancel_pending",
          errorMessage: message.slice(0, 500),
        });
        return { action: "cancel_failed" };
      }
    }
  }

  try {
    await deps.downgradeTenant(local.tenantId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "downgrade_failed";
    await deps.updateAudit(auditId, {
      status: "downgrade_failed",
      reconciliationStatus: "canceled_downgrade_pending",
      errorMessage: message.slice(0, 500),
    });
    return { action: "downgrade_failed" };
  }

  await deps.updateAudit(auditId, {
    status: "reconciled",
    reconciliationStatus: "refunded_canceled_free",
    errorMessage: null,
  });

  return { action: "reconciled" };
}

import type { AuditInsert, AuditPatch } from "@/lib/billing/subscriptionRefund";
import type { OpenAudit } from "@/lib/billing/refundDecisions";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AuditRow = {
  id: string;
  status: string;
  stripe_refund_id: string | null;
  created_at: string;
};

function mapAudit(row: AuditRow): OpenAudit {
  return {
    id: row.id,
    status: row.status,
    stripeRefundId: row.stripe_refund_id,
    createdAtMs: new Date(row.created_at).getTime(),
  };
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function findOpenFullByInvoice(
  invoiceId: string,
): Promise<OpenAudit | null> {
  const { data, error } = await supabaseAdmin
    .from("billing_refund_audits")
    .select("id, status, stripe_refund_id, created_at")
    .eq("stripe_invoice_id", invoiceId)
    .eq("refund_kind", "full")
    .neq("status", "failed")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapAudit(data) : null;
}

export async function findAuditByRefundId(
  refundId: string,
): Promise<OpenAudit | null> {
  const { data, error } = await supabaseAdmin
    .from("billing_refund_audits")
    .select("id, status, stripe_refund_id, created_at")
    .eq("stripe_refund_id", refundId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapAudit(data) : null;
}

export async function insertRefundAudit(
  row: AuditInsert,
): Promise<{ ok: true; id: string; createdAtMs: number } | { ok: false; conflict: true }> {
  const { data, error } = await supabaseAdmin
    .from("billing_refund_audits")
    .insert({
      tenant_id: row.tenantId,
      initiated_by_user_id: row.initiatedByUserId,
      initiated_by_email: row.initiatedByEmail,
      source: row.source,
      stripe_customer_id: row.stripeCustomerId,
      stripe_subscription_id: row.stripeSubscriptionId,
      stripe_invoice_id: row.stripeInvoiceId,
      stripe_payment_intent_id: row.stripePaymentIntentId,
      stripe_charge_id: row.stripeChargeId,
      stripe_refund_id: row.stripeRefundId,
      amount: row.amount,
      currency: row.currency,
      refund_kind: row.refundKind,
      status: row.status,
      reconciliation_status: row.reconciliationStatus,
      error_message: row.errorMessage,
      idempotency_key: row.idempotencyKey,
    })
    .select("id, created_at")
    .single();

  if (error) {
    if (isUniqueViolation(error)) return { ok: false, conflict: true };
    throw new Error(error.message);
  }

  return {
    ok: true,
    id: data.id,
    createdAtMs: new Date(data.created_at).getTime(),
  };
}

export async function updateRefundAudit(
  id: string,
  patch: AuditPatch,
): Promise<void> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.stripeRefundId !== undefined) update.stripe_refund_id = patch.stripeRefundId;
  if (patch.stripePaymentIntentId !== undefined) {
    update.stripe_payment_intent_id = patch.stripePaymentIntentId;
  }
  if (patch.stripeChargeId !== undefined) update.stripe_charge_id = patch.stripeChargeId;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.reconciliationStatus !== undefined) {
    update.reconciliation_status = patch.reconciliationStatus;
  }
  if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
  if (patch.refundKind !== undefined) update.refund_kind = patch.refundKind;

  const { error } = await supabaseAdmin
    .from("billing_refund_audits")
    .update(update)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

import { downgradeTenantToFree } from "@/lib/billing/syncStripeSubscription";
import {
  executeAdminRefund,
  inspectTenantRefund,
  type AdminRefundDeps,
  type LocalSubscription,
} from "@/lib/billing/subscriptionRefund";
import {
  cancelSubscriptionForRefund,
  createFullRefund,
  isAlreadyRefundedError,
  isRefundInProgressError,
  listPaidInvoices,
  listPaymentRefunds,
  loadStripeSubscription,
  resolveInvoicePayment,
} from "@/lib/billing/stripeRefundGateway";
import {
  findOpenFullByInvoice,
  insertRefundAudit,
  updateRefundAudit,
} from "@/lib/billing/refundAuditStore";
import { supabaseAdmin } from "@/lib/supabase/admin";

type TenantRow = { id: string; name: string | null; slug: string | null };
type SubscriptionRow = {
  tenant_id: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string | null;
};

async function planOf(planId: string | null): Promise<{
  name: string | null;
  slug: string | null;
}> {
  if (!planId) return { name: null, slug: null };
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("name, slug")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { name: data?.name ?? null, slug: data?.slug ?? null };
}

async function tenantOf(tenantId: string): Promise<TenantRow | null> {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("id, name, slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function toLocal(
  tenant: TenantRow,
  sub: SubscriptionRow | null,
  plan: { name: string | null; slug: string | null },
): LocalSubscription {
  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    stripeCustomerId: sub?.stripe_customer_id ?? null,
    stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    status: sub?.status ?? null,
    planSlug: plan.slug,
    planName: plan.name,
  };
}

export async function loadLocalSubscription(
  tenantId: string,
): Promise<LocalSubscription | null> {
  const tenant = await tenantOf(tenantId);
  if (!tenant) return null;
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("tenant_id, status, stripe_customer_id, stripe_subscription_id, plan_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const plan = await planOf(data?.plan_id ?? null);
  return toLocal(tenant, data, plan);
}

async function loadFromSubscriptionRow(
  row: SubscriptionRow | null,
): Promise<LocalSubscription | null> {
  if (!row?.tenant_id) return null;
  const tenant = await tenantOf(row.tenant_id);
  if (!tenant) return null;
  const plan = await planOf(row.plan_id);
  return toLocal(tenant, row, plan);
}

export async function loadLocalByStripeSubscription(
  subscriptionId: string,
): Promise<LocalSubscription | null> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("tenant_id, status, stripe_customer_id, stripe_subscription_id, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return loadFromSubscriptionRow(data);
}

export async function loadLocalByStripeCustomer(
  customerId: string,
): Promise<LocalSubscription | null> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("tenant_id, status, stripe_customer_id, stripe_subscription_id, plan_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) {
    console.error("refund customer lookup", error.message);
    return null;
  }
  return loadFromSubscriptionRow(data);
}

function adminDeps(): AdminRefundDeps {
  return {
    now: () => Date.now(),
    loadLocal: loadLocalSubscription,
    loadStripeSubscription,
    listInvoices: listPaidInvoices,
    resolvePayment: resolveInvoicePayment,
    createRefund: createFullRefund,
    listRefunds: listPaymentRefunds,
    cancelSubscription: cancelSubscriptionForRefund,
    downgradeTenant: downgradeTenantToFree,
    findOpenFullByInvoice,
    insertAudit: insertRefundAudit,
    updateAudit: updateRefundAudit,
    isAlreadyRefundedError,
    isInProgressError: isRefundInProgressError,
  };
}

export function inspectTenantRefundForAdmin(tenantId: string) {
  return inspectTenantRefund(adminDeps(), tenantId);
}

export function executeTenantRefundForAdmin(input: {
  tenantId: string;
  actorUserId: string;
  actorEmail: string;
}) {
  return executeAdminRefund(adminDeps(), input);
}

import { buildAccountingReport } from "@/lib/accounting/report";
import type { AccountingPeriod } from "@/lib/accounting/period";
import { readStripePayments, stripeAccountingClient } from "@/lib/accounting/stripeRead";
import type { AccountingReport, TenantMatch } from "@/lib/accounting/types";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TENANT_SELECT =
  "tenant_id, stripe_customer_id, stripe_subscription_id, tenants(name, billing_type, billing_name, billing_cui, billing_address_line1, billing_city, billing_county, billing_postal_code, billing_country)";

type TenantJoin = {
  name?: string | null;
  billing_type?: string | null;
  billing_name?: string | null;
  billing_cui?: string | null;
  billing_address_line1?: string | null;
  billing_city?: string | null;
  billing_county?: string | null;
  billing_postal_code?: string | null;
  billing_country?: string | null;
};

type SubscriptionBillingRow = {
  tenant_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tenants: TenantJoin | TenantJoin[] | null;
};

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function oneTenant(value: SubscriptionBillingRow["tenants"]): TenantJoin | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toMatch(row: SubscriptionBillingRow): TenantMatch | null {
  if (!row.tenant_id) return null;
  const tenant = oneTenant(row.tenants);
  return {
    tenantId: row.tenant_id,
    tenantName: tenant?.name ?? null,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    billingType: tenant?.billing_type ?? null,
    billingName: tenant?.billing_name ?? null,
    billingCui: tenant?.billing_cui ?? null,
    addressLine1: tenant?.billing_address_line1 ?? null,
    city: tenant?.billing_city ?? null,
    county: tenant?.billing_county ?? null,
    postalCode: tenant?.billing_postal_code ?? null,
    country: tenant?.billing_country ?? null,
  };
}

async function loadMatches(
  column: "stripe_customer_id" | "stripe_subscription_id",
  ids: string[],
): Promise<TenantMatch[]> {
  const matches: TenantMatch[] = [];
  for (const group of chunks(ids, 80)) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select(TENANT_SELECT)
      .in(column, group);
    if (error) {
      console.error("accounting tenant lookup", error.message);
      throw new Error("Nu am putut încărca saloanele pentru raport.");
    }
    for (const row of (data ?? []) as SubscriptionBillingRow[]) {
      const match = toMatch(row);
      if (match) matches.push(match);
    }
  }
  return matches;
}

export async function loadTenantMatches(input: {
  customerIds: string[];
  subscriptionIds: string[];
}): Promise<TenantMatch[]> {
  const customers = [...new Set(input.customerIds.filter(Boolean))];
  const subscriptions = [...new Set(input.subscriptionIds.filter(Boolean))];
  const [byCustomer, bySubscription] = await Promise.all([
    customers.length > 0 ? loadMatches("stripe_customer_id", customers) : Promise.resolve([]),
    subscriptions.length > 0
      ? loadMatches("stripe_subscription_id", subscriptions)
      : Promise.resolve([]),
  ]);
  const merged = new Map<string, TenantMatch>();
  for (const match of [...byCustomer, ...bySubscription]) {
    const key = `${match.tenantId}:${match.stripeSubscriptionId ?? ""}:${match.stripeCustomerId ?? ""}`;
    merged.set(key, match);
  }
  return [...merged.values()];
}

export async function loadAccountingReport(
  period: AccountingPeriod,
): Promise<AccountingReport> {
  const collected = await readStripePayments(stripeAccountingClient(getStripe()), period);
  const subscriptionIds = collected.invoices
    .map((invoice) => invoice.subscriptionId)
    .filter((id): id is string => Boolean(id));
  const customerIds = collected.charges
    .map((charge) =>
      typeof charge.customer === "string" ? charge.customer : charge.customer?.id,
    )
    .filter((id): id is string => Boolean(id));
  const tenants = await loadTenantMatches({ customerIds, subscriptionIds });
  return buildAccountingReport({
    ...collected,
    tenants,
    period,
  });
}

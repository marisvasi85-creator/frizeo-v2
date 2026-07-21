import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asNumber, asString } from "./helpers";

export async function listTenantsTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const query = asString(args.query)?.toLowerCase() || null;
  const statusFilter = asString(args.subscription_status)?.toLowerCase() || null;
  const limit = Math.min(Math.max(asNumber(args.limit) ?? 20, 1), 50);

  const { data: tenants, error } = await supabaseAdmin
    .from("tenants")
    .select("id, name, slug, phone, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut lista saloanele.",
      error: error.message,
    };
  }

  let rows = tenants ?? [];
  if (query) {
    rows = rows.filter((t) => {
      const hay = `${t.name || ""} ${t.slug || ""} ${t.phone || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }

  const tenantIds = rows.map((t) => t.id);
  const [{ data: subs }, { data: barberCounts }] = await Promise.all([
    tenantIds.length
      ? supabaseAdmin
          .from("subscriptions")
          .select("tenant_id, status, trial_ends_at, stripe_subscription_id, plans(name, slug)")
          .in("tenant_id", tenantIds)
      : Promise.resolve({ data: [] as any[] }),
    tenantIds.length
      ? supabaseAdmin
          .from("barbers")
          .select("tenant_id, active")
          .in("tenant_id", tenantIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const subByTenant = new Map(
    (subs ?? []).map((s) => [s.tenant_id, s]),
  );
  const activeBarbersByTenant = new Map<string, number>();
  for (const b of barberCounts ?? []) {
    if (!b.active) continue;
    activeBarbersByTenant.set(
      b.tenant_id,
      (activeBarbersByTenant.get(b.tenant_id) || 0) + 1,
    );
  }

  let enriched = rows.map((t) => {
    const sub = subByTenant.get(t.id) as
      | {
          status?: string;
          trial_ends_at?: string | null;
          stripe_subscription_id?: string | null;
          plans?: { name?: string; slug?: string } | null;
        }
      | undefined;
    const plan = sub?.plans;
    return {
      tenant_id: t.id,
      name: t.name,
      slug: t.slug,
      phone: t.phone,
      created_at: t.created_at,
      plan_name: plan?.name || null,
      plan_slug: plan?.slug || null,
      subscription_status: sub?.status || null,
      trial_ends_at: sub?.trial_ends_at || null,
      has_stripe: Boolean(sub?.stripe_subscription_id),
      active_barbers: activeBarbersByTenant.get(t.id) || 0,
    };
  });

  if (statusFilter) {
    enriched = enriched.filter(
      (t) => (t.subscription_status || "").toLowerCase() === statusFilter,
    );
  }

  const sliced = enriched.slice(0, limit);

  return {
    ok: true,
    summary: `${sliced.length} saloane${query ? ` pentru „${query}"` : ""}${
      statusFilter ? ` (status=${statusFilter})` : ""
    }.`,
    data: {
      tenants: sliced,
      total_matched: enriched.length,
      truncated: enriched.length > sliced.length,
    },
  };
}

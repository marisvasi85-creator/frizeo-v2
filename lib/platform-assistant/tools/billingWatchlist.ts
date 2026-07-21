import { addDaysToDateString, getTodayInBookingTimezone } from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asNumber } from "./helpers";

export async function billingWatchlistTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const days = Math.min(Math.max(asNumber(args.days) ?? 14, 1), 60);
  const today = getTodayInBookingTimezone();
  const until = addDaysToDateString(today, days);

  const [{ data: trials }, { data: pastDue }] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select(
        "tenant_id, status, trial_ends_at, stripe_subscription_id, plans(name, slug)",
      )
      .eq("status", "trialing")
      .not("trial_ends_at", "is", null)
      .gte("trial_ends_at", today)
      .lte("trial_ends_at", `${until}T23:59:59`),
    supabaseAdmin
      .from("subscriptions")
      .select(
        "tenant_id, status, trial_ends_at, stripe_subscription_id, plans(name, slug)",
      )
      .eq("status", "past_due"),
  ]);

  const tenantIds = [
    ...new Set([
      ...(trials ?? []).map((t) => t.tenant_id),
      ...(pastDue ?? []).map((t) => t.tenant_id),
    ]),
  ];

  const { data: tenants } = tenantIds.length
    ? await supabaseAdmin
        .from("tenants")
        .select("id, name, slug")
        .in("id", tenantIds)
    : { data: [] as { id: string; name: string; slug: string }[] };

  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));

  const mapRow = (row: any) => {
    const tenant = tenantById.get(row.tenant_id);
    const plan = row.plans as { name?: string; slug?: string } | null;
    return {
      tenant_id: row.tenant_id,
      name: tenant?.name || null,
      slug: tenant?.slug || null,
      status: row.status,
      trial_ends_at: row.trial_ends_at,
      plan_name: plan?.name || null,
      has_stripe: Boolean(row.stripe_subscription_id),
    };
  };

  const trialsMapped = (trials ?? [])
    .map(mapRow)
    .sort((a, b) =>
      String(a.trial_ends_at || "").localeCompare(String(b.trial_ends_at || "")),
    );
  const pastDueMapped = (pastDue ?? []).map(mapRow);

  return {
    ok: true,
    summary: `Watchlist: ${trialsMapped.length} trial-uri care expiră în ${days} zile, ${pastDueMapped.length} past_due.`,
    data: {
      days,
      trials_ending_soon: trialsMapped,
      past_due: pastDueMapped,
    },
  };
}

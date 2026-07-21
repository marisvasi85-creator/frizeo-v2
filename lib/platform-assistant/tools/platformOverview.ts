import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";

export async function platformOverviewTool(
  _args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const [
    tenantsRes,
    activeBarbersRes,
    bookingsMonthRes,
    subscriptionsRes,
  ] = await Promise.all([
    supabaseAdmin.from("tenants").select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("barbers")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10))
      .neq("status", "cancelled"),
    supabaseAdmin.from("subscriptions").select("status, trial_ends_at, stripe_subscription_id"),
  ]);

  const subs = subscriptionsRes.data ?? [];
  const byStatus: Record<string, number> = {};
  let trialing = 0;
  let pastDue = 0;
  let activePaid = 0;

  for (const sub of subs) {
    const status = String(sub.status || "unknown");
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (status === "trialing") trialing += 1;
    if (status === "past_due") pastDue += 1;
    if (status === "active" && sub.stripe_subscription_id) activePaid += 1;
  }

  const data = {
    tenants: tenantsRes.count ?? 0,
    active_barbers: activeBarbersRes.count ?? 0,
    bookings_this_month: bookingsMonthRes.count ?? 0,
    subscriptions_total: subs.length,
    subscriptions_by_status: byStatus,
    trialing,
    past_due: pastDue,
    active_paid: activePaid,
  };

  return {
    ok: true,
    summary: `Platformă: ${data.tenants} saloane, ${data.active_barbers} frizeri activi, ${data.bookings_this_month} programări luna asta. Trial: ${trialing}, active plătite: ${activePaid}, past_due: ${pastDue}.`,
    data,
  };
}

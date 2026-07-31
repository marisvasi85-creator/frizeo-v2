import { supabaseAdmin } from "@/lib/supabase/admin";
import { planHasActiveEntitlements } from "./entitlements";
import { getCurrentPlan } from "./getCurrentPlan";
import { getPlanIdBySlug } from "./getPlanIdBySlug";
import { PLAN_SLUGS } from "./plans";

async function resolveFreeBookingLimit(): Promise<number | null> {
  const freePlanId = await getPlanIdBySlug(PLAN_SLUGS.FREE);
  if (!freePlanId) return 80;

  const { data } = await supabaseAdmin
    .from("plans")
    .select("max_bookings_per_month")
    .eq("id", freePlanId)
    .maybeSingle();

  return typeof data?.max_bookings_per_month === "number"
    ? data.max_bookings_per_month
    : 80;
}

export async function checkBookingLimit(tenantId: string) {
  const plan = await getCurrentPlan(tenantId);

  if (!plan) {
    return {
      allowed: false,
      reason: "Plan inexistent",
    };
  }

  const entitled = planHasActiveEntitlements(plan);
  const maxBookings = entitled
    ? plan.max_bookings_per_month
    : await resolveFreeBookingLimit();

  if (!maxBookings) {
    return {
      allowed: true,
    };
  }

  const now = new Date();

  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const { count } = await supabaseAdmin
    .from("bookings")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("tenant_id", tenantId)
    .gte("date", firstDay)
    .neq("status", "cancelled");

  const current = count || 0;

  return {
    allowed: current < maxBookings,
    current,
    limit: maxBookings,
  };
}

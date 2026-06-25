import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentPlan } from "./getCurrentPlan";

export async function checkBookingLimit(
  tenantId: string
) {
  const plan = await getCurrentPlan(tenantId);

  if (!plan) {
    return {
      allowed: false,
      reason: "Plan inexistent",
    };
  }

  if (!plan.max_bookings_per_month) {
    return {
      allowed: true,
    };
  }

  const now = new Date();

  const firstDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  )
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
    allowed: current < plan.max_bookings_per_month,
    current,
    limit: plan.max_bookings_per_month,
  };
}
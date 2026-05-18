import { createSupabasePublicClient } from "@/lib/supabase/public";

export async function canCreateBooking(tenantId: string) {
  const supabase = createSupabasePublicClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("tenant_id", tenantId)
    .single();

  if (!sub) return false;

  const { data: plan } = await supabase
    .from("plans")
    .select("max_bookings_per_month")
    .eq("id", sub.plan_id)
    .single();
    
  if (!plan) {
  console.error("Plan not found for tenant:", tenantId);
  return false;
}
  const limit = plan?.max_bookings_per_month;

  if (!limit) return true;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed")
    .gte("created_at", startOfMonth.toISOString());

  return (count || 0) < limit;
}
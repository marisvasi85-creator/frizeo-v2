import { supabaseAdmin } from "@/lib/supabase/admin";

export async function canCreateBarber(tenantId: string) {
  const supabase = supabaseAdmin;

  // 🔥 plan
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("tenant_id", tenantId)
    .single();

  if (!sub) return false;

  const { data: plan } = await supabase
    .from("plans")
    .select("max_barbers")
    .eq("id", sub.plan_id)
    .single();

  const limit = plan?.max_barbers;

  if (!limit) return true; // unlimited

  // 🔥 count barbers
  const { count } = await supabase
    .from("barbers")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
.eq("active", true);

  return (count || 0) < limit;
}
import { createSupabasePublicClient } from "@/lib/supabase/public";

export async function getCurrentPlan(
  tenantId: string
) {
  const supabase = createSupabasePublicClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("tenant_id", tenantId)
    .single();

  if (!subscription?.plan_id) {
    return null;
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", subscription.plan_id)
    .single();

  return plan ?? null;
}
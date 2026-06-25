import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getCurrentPlan(
  tenantId: string
) {
  const supabase = supabaseAdmin;

  const { data: subscription } =
    await supabase
      .from("subscriptions")
      .select(`
        *,
        plans (*)
      `)
      .eq("tenant_id", tenantId)
      .single();

  if (!subscription) {
    return null;
  }

  return {
    ...subscription.plans,
    trial_ends_at:
      subscription.trial_ends_at,

    status:
      subscription.status,
  };
}
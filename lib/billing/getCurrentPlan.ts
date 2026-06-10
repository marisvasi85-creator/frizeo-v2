import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentPlan(
  tenantId: string
) {
  const supabase = await createSupabaseServerClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(`
      *,
      plans (*)
    `)
    .eq("tenant_id", tenantId)
    .single();

  return subscription?.plans ?? null;
}
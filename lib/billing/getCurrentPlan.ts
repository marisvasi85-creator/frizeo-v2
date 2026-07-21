import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const getCurrentPlan = cache(async (tenantId: string) => {
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select(
      `
        *,
        plans (*)
      `,
    )
    .eq("tenant_id", tenantId)
    .single();

  if (!subscription) {
    return null;
  }

  return {
    ...subscription.plans,
    trial_ends_at: subscription.trial_ends_at,
    status: subscription.status,
  };
});

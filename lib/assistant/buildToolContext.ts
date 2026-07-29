import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext } from "./types";

/**
 * For owners, only expose barberId when their barber profile is active.
 * Admin-only owners must pick an active teammate for barber-scoped tools.
 */
export async function buildAssistantToolContext(input: {
  tenantId: string;
  userId: string;
  role: AssistantToolContext["role"];
  allowConfirmed?: boolean;
}): Promise<AssistantToolContext> {
  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id, active")
    .eq("user_id", input.userId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  const actsAsBarber =
    input.role === "barber"
      ? Boolean(barber?.id)
      : Boolean(barber?.id && barber.active);

  return {
    tenantId: input.tenantId,
    userId: input.userId,
    role: input.role,
    barberId: actsAsBarber ? (barber?.id ?? null) : null,
    actsAsBarber,
    allowConfirmed: input.allowConfirmed,
  };
}

import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";

export async function subscriptionStatusTool(
  _args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const plan = await getCurrentPlan(ctx.tenantId);

  if (!plan) {
    return {
      ok: true,
      summary: "Nu există abonament înregistrat.",
      data: { status: "unknown" },
    };
  }

  const trialEndsAt =
    typeof plan.trial_ends_at === "string" ? plan.trial_ends_at : null;
  let trialDaysLeft: number | null = null;
  if (trialEndsAt) {
    trialDaysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
  }

  const { count: activeBarbers } = await supabaseAdmin
    .from("barbers")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .eq("active", true);

  const maxBarbers =
    typeof (plan as { max_barbers?: number | null }).max_barbers === "number" ||
    (plan as { max_barbers?: number | null }).max_barbers === null
      ? ((plan as { max_barbers?: number | null }).max_barbers ?? null)
      : null;

  const data = {
    plan_name: (plan as { name?: string }).name ?? null,
    plan_slug: (plan as { slug?: string }).slug ?? null,
    status: plan.status,
    trial_ends_at: trialEndsAt,
    trial_days_left: trialDaysLeft,
    max_active_barbers: maxBarbers,
    active_barbers: activeBarbers ?? 0,
    owner_acts_as_barber: ctx.actsAsBarber ?? Boolean(ctx.barberId),
  };

  const seats =
    maxBarbers === null
      ? `${data.active_barbers} frizeri activi (nelimitat / custom)`
      : `${data.active_barbers} / ${maxBarbers} frizeri activi`;

  return {
    ok: true,
    summary: `Plan: ${data.plan_name ?? "necunoscut"} (${data.status}). ${seats}.`,
    data,
  };
}

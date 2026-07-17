import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
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

  // Fără date financiare / încasări — doar status plan Frizeo.
  const data = {
    plan_name: (plan as { name?: string }).name ?? null,
    plan_slug: (plan as { slug?: string }).slug ?? null,
    status: plan.status,
    trial_ends_at: trialEndsAt,
    trial_days_left: trialDaysLeft,
  };

  return {
    ok: true,
    summary: `Plan: ${data.plan_name ?? "necunoscut"} (${data.status}).`,
    data,
  };
}

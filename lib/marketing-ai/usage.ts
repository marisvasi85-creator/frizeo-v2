import { getTodayInBookingTimezone } from "@/lib/bookings/bookingTimezone";
import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
import { getMarketingAIProviderConfig } from "./providers/config";
import {
  formatMarketingAILimitMessage,
  getMarketingAILimitForPlan,
} from "./limits";
import { supabaseAdmin } from "@/lib/supabase/admin";

let usageTableReady: boolean | null = null;

export async function hasMarketingAIUsageTable(): Promise<boolean> {
  if (usageTableReady !== null) return usageTableReady;

  const { error } = await supabaseAdmin
    .from("marketing_ai_generations")
    .select("id")
    .limit(1);

  usageTableReady = !error;
  return usageTableReady;
}

export function marketingAIUsageMigrationMessage(): string {
  return "Rulează migrarea supabase/migrations/20260710_marketing_ai_generations.sql în Supabase SQL Editor pentru a activa limitele Marketing AI.";
}

export type MarketingAIUsageStatus = {
  used: number;
  limit: number | null;
  remaining: number | null;
  planLabel: string;
  unlimited: boolean;
  countsTowardLimit: boolean;
  migrationReady: boolean;
};

export async function getMarketingAIUsageStatus(
  tenantId: string,
): Promise<MarketingAIUsageStatus> {
  const plan = await getCurrentPlan(tenantId);
  const limitConfig = getMarketingAILimitForPlan(plan);
  const providerConfig = getMarketingAIProviderConfig();
  const migrationReady = await hasMarketingAIUsageTable();

  const countsTowardLimit = providerConfig.provider !== "template";
  const unlimited =
    !countsTowardLimit || limitConfig.daily === null || !migrationReady;

  if (unlimited) {
    return {
      used: 0,
      limit: limitConfig.daily,
      remaining: limitConfig.daily,
      planLabel: limitConfig.label,
      unlimited: true,
      countsTowardLimit,
      migrationReady,
    };
  }

  const today = getTodayInBookingTimezone();
  const { count } = await supabaseAdmin
    .from("marketing_ai_generations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("usage_date", today);

  const used = count ?? 0;
  const limit = limitConfig.daily!;
  const remaining = Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    planLabel: limitConfig.label,
    unlimited: false,
    countsTowardLimit,
    migrationReady,
  };
}

export async function checkMarketingAILimit(tenantId: string): Promise<{
  allowed: boolean;
  reason?: string;
  usage: MarketingAIUsageStatus;
}> {
  const usage = await getMarketingAIUsageStatus(tenantId);

  if (usage.unlimited) {
    return { allowed: true, usage };
  }

  if (!usage.migrationReady) {
    return { allowed: true, usage };
  }

  if (usage.remaining !== null && usage.remaining <= 0) {
    return {
      allowed: false,
      reason: `${formatMarketingAILimitMessage(usage.used, usage.limit!, usage.planLabel)} Upgrade la Pro pentru mai multe generări.`,
      usage,
    };
  }

  return { allowed: true, usage };
}

export async function recordMarketingAIUsage(input: {
  tenantId: string;
  barberId: string;
  contentType: string;
  provider: string;
  countsTowardLimit?: boolean;
}) {
  if (input.countsTowardLimit === false) return;

  const migrationReady = await hasMarketingAIUsageTable();
  if (!migrationReady) return;

  const today = getTodayInBookingTimezone();

  await supabaseAdmin.from("marketing_ai_generations").insert({
    tenant_id: input.tenantId,
    barber_id: input.barberId,
    content_type: input.contentType,
    provider: input.provider,
    usage_date: today,
  });
}

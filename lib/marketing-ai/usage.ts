import { getTodayInBookingTimezone } from "@/lib/bookings/bookingTimezone";
import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
import { getMarketingAIProviderConfig } from "./providers/config";
import {
  formatMarketingAILimitMessage,
  getMarketingAILimitForPlan,
} from "./limits";
import { supabaseAdmin } from "@/lib/supabase/admin";

let usageTableReady: boolean | null = null;
let countedColumnReady: boolean | null = null;

export async function hasMarketingAIUsageTable(): Promise<boolean> {
  if (usageTableReady !== null) return usageTableReady;

  const { error } = await supabaseAdmin
    .from("marketing_ai_generations")
    .select("id")
    .limit(1);

  usageTableReady = !error;
  return usageTableReady;
}

async function hasCountsTowardLimitColumn(): Promise<boolean> {
  if (countedColumnReady !== null) return countedColumnReady;

  const tableReady = await hasMarketingAIUsageTable();
  if (!tableReady) {
    countedColumnReady = false;
    return false;
  }

  const { error } = await supabaseAdmin
    .from("marketing_ai_generations")
    .select("id, counts_toward_limit")
    .limit(1);

  countedColumnReady = !error;
  return countedColumnReady;
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

async function countUsageForToday(tenantId: string): Promise<number> {
  const today = getTodayInBookingTimezone();
  const hasCountedCol = await hasCountsTowardLimitColumn();

  let query = supabaseAdmin
    .from("marketing_ai_generations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("usage_date", today);

  if (hasCountedCol) {
    query = query.eq("counts_toward_limit", true);
  }

  const { count } = await query;
  return count ?? 0;
}

export async function getMarketingAIUsageStatus(
  tenantId: string,
): Promise<MarketingAIUsageStatus> {
  const [plan, migrationReady] = await Promise.all([
    getCurrentPlan(tenantId),
    hasMarketingAIUsageTable(),
  ]);
  const limitConfig = getMarketingAILimitForPlan(plan);
  const providerConfig = getMarketingAIProviderConfig();

  const countsTowardLimit = providerConfig.provider !== "template";
  const unlimited = !countsTowardLimit || limitConfig.daily === null;

  if (unlimited) {
    let used = 0;
    if (migrationReady && countsTowardLimit) {
      used = await countUsageForToday(tenantId);
    }

    return {
      used,
      limit: null,
      remaining: null,
      planLabel: limitConfig.label,
      unlimited: true,
      countsTowardLimit,
      migrationReady,
    };
  }

  let used = 0;
  if (migrationReady) {
    used = await countUsageForToday(tenantId);
  }

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
    const upgradeHint =
      usage.planLabel === "Free"
        ? " Upgrade la Pro pentru mai multe generări."
        : usage.planLabel === "Pro"
          ? " Upgrade la Pro+ pentru mai multe generări."
          : " Contactează-ne pentru plan Custom.";

    return {
      allowed: false,
      reason: `${formatMarketingAILimitMessage(usage.used, usage.limit!, usage.planLabel)}${upgradeHint}`,
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
  result?: {
    title: string;
    content: string;
    hashtags: string[];
    callToAction: string;
  };
  serviceId?: string;
}): Promise<string | null> {
  const shouldCount = input.countsTowardLimit !== false;
  const hasPayload = Boolean(input.result?.content);

  // Always persist when we have content (history). Count only when shouldCount.
  if (!shouldCount && !hasPayload) return null;

  const migrationReady = await hasMarketingAIUsageTable();
  if (!migrationReady) return null;

  const today = getTodayInBookingTimezone();
  const hasCountedCol = await hasCountsTowardLimitColumn();

  const baseRow: Record<string, unknown> = {
    tenant_id: input.tenantId,
    barber_id: input.barberId,
    content_type: input.contentType,
    provider: input.provider,
    usage_date: today,
  };

  if (hasCountedCol) {
    baseRow.counts_toward_limit = shouldCount;
  } else if (!shouldCount) {
    // Without the flag column, skip insert so template-fallback doesn't inflate limits.
    // History requires the new migration.
    return null;
  }

  const payloadRow = input.result
    ? {
        ...baseRow,
        title: input.result.title,
        content: input.result.content,
        hashtags: input.result.hashtags,
        call_to_action: input.result.callToAction,
        service_id: input.serviceId ?? null,
      }
    : baseRow;

  const { data, error } = await supabaseAdmin
    .from("marketing_ai_generations")
    .insert(payloadRow)
    .select("id")
    .maybeSingle();

  if (!error) {
    return (data?.id as string | undefined) ?? null;
  }

  // Payload columns missing — fall back to usage-only row when counting.
  if (shouldCount) {
    const usageOnly = { ...baseRow };
    delete usageOnly.title;
    delete usageOnly.content;
    delete usageOnly.hashtags;
    delete usageOnly.call_to_action;
    delete usageOnly.service_id;

    const { data: fallbackData, error: fallbackError } = await supabaseAdmin
      .from("marketing_ai_generations")
      .insert(usageOnly)
      .select("id")
      .maybeSingle();

    if (fallbackError) return null;
    return (fallbackData?.id as string | undefined) ?? null;
  }

  return null;
}

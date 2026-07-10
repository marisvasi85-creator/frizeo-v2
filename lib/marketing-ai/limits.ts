import { PLAN_SLUGS, type PlanLike } from "@/lib/billing/plans";

export type MarketingAILimit = {
  daily: number | null;
  label: string;
};

const DEFAULT_LIMITS: Record<string, MarketingAILimit> = {
  [PLAN_SLUGS.FREE]: { daily: 3, label: "Free" },
  [PLAN_SLUGS.PRO]: { daily: 20, label: "Pro" },
  [PLAN_SLUGS.PRO_PLUS]: { daily: 50, label: "Pro+" },
  [PLAN_SLUGS.CUSTOM]: { daily: null, label: "Custom" },
};

function envLimit(key: string, fallback: number | null): number | null {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  if (raw === "unlimited" || raw === "null") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getMarketingAILimitForPlan(
  plan: PlanLike | null | undefined,
): MarketingAILimit {
  if (plan?.status === "trialing") {
    return {
      daily: envLimit("MARKETING_AI_DAILY_LIMIT_TRIAL", 50),
      label: "Trial Pro+",
    };
  }

  const slug = plan?.slug ?? PLAN_SLUGS.FREE;
  const base = DEFAULT_LIMITS[slug] ?? DEFAULT_LIMITS[PLAN_SLUGS.FREE];

  const envKey = `MARKETING_AI_DAILY_LIMIT_${slug.toUpperCase().replace("-", "_")}`;
  return {
    daily: envLimit(envKey, base.daily),
    label: base.label,
  };
}

export function formatMarketingAILimitMessage(
  used: number,
  limit: number,
  planLabel: string,
): string {
  return `Ai folosit ${used}/${limit} generări AI azi (plan ${planLabel}). Limita se resetează la miezul nopții.`;
}

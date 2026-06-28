export const PLAN_SLUGS = {
  FREE: "free",
  PRO: "pro",
  PRO_PLUS: "pro-plus",
  CUSTOM: "custom",
} as const;

export type PlanSlug = (typeof PLAN_SLUGS)[keyof typeof PLAN_SLUGS];

/** Planuri afișate în app — Free, Pro, Pro+, Custom */
export const CANONICAL_PLAN_SLUGS: PlanSlug[] = [
  PLAN_SLUGS.FREE,
  PLAN_SLUGS.PRO,
  PLAN_SLUGS.PRO_PLUS,
  PLAN_SLUGS.CUSTOM,
];

export function isCanonicalPlanSlug(
  slug: string | null | undefined
): slug is PlanSlug {
  return CANONICAL_PLAN_SLUGS.includes(slug as PlanSlug);
}

export function sortPlansByCanonicalOrder<
  T extends { slug?: string | null },
>(plans: T[]): T[] {
  return CANONICAL_PLAN_SLUGS.map((slug) =>
    plans.find((plan) => plan.slug === slug)
  ).filter((plan): plan is T => Boolean(plan));
}

export type PlanLike = {
  slug?: string | null;
  status?: string | null;
};

/** SMS: trial (Pro+) + paid plans Pro, Pro+, Custom */
export function planAllowsSms(plan: PlanLike | null | undefined): boolean {
  if (!plan) return false;
  if (plan.status === "trialing") return true;

  const slug = plan.slug ?? "";
  return (
    slug === PLAN_SLUGS.PRO ||
    slug === PLAN_SLUGS.PRO_PLUS ||
    slug === PLAN_SLUGS.CUSTOM
  );
}

export function isPaidPlan(plan: PlanLike | null | undefined): boolean {
  if (!plan) return false;
  if (plan.status === "trialing") return true;

  const slug = plan.slug ?? "";
  return slug !== PLAN_SLUGS.FREE && slug !== "";
}

/** free < pro < pro-plus < custom */
const PLAN_TIER: Record<PlanSlug, number> = {
  [PLAN_SLUGS.FREE]: 0,
  [PLAN_SLUGS.PRO]: 1,
  [PLAN_SLUGS.PRO_PLUS]: 2,
  [PLAN_SLUGS.CUSTOM]: 3,
};

export function getPlanTier(slug: string | null | undefined): number {
  if (slug && isCanonicalPlanSlug(slug)) {
    return PLAN_TIER[slug];
  }
  return 0;
}

export function isPlanDowngrade(
  currentSlug: string | null | undefined,
  targetSlug: string | null | undefined
): boolean {
  return getPlanTier(targetSlug) < getPlanTier(currentSlug);
}

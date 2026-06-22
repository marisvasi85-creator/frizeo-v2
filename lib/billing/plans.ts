export const PLAN_SLUGS = {
  FREE: "free",
  PRO: "pro",
  PRO_PLUS: "pro-plus",
  CUSTOM: "custom",
} as const;

export type PlanSlug = (typeof PLAN_SLUGS)[keyof typeof PLAN_SLUGS];

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

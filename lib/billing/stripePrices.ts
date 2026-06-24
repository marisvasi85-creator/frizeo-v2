import type { PlanSlug } from "./plans";
import { PLAN_SLUGS } from "./plans";

export function getStripePriceId(slug: PlanSlug): string | null {
  if (slug === PLAN_SLUGS.PRO) {
    return process.env.STRIPE_PRICE_PRO?.trim() || null;
  }

  if (slug === PLAN_SLUGS.PRO_PLUS) {
    return process.env.STRIPE_PRICE_PRO_PLUS?.trim() || null;
  }

  return null;
}

export function getPlanSlugFromStripePriceId(
  priceId: string
): PlanSlug | null {
  const pro = process.env.STRIPE_PRICE_PRO?.trim();
  const proPlus = process.env.STRIPE_PRICE_PRO_PLUS?.trim();

  if (pro && priceId === pro) return PLAN_SLUGS.PRO;
  if (proPlus && priceId === proPlus) return PLAN_SLUGS.PRO_PLUS;

  return null;
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.frizeo.ro"
  );
}

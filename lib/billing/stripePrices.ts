import type { PlanSlug } from "./plans";
import { PLAN_SLUGS } from "./plans";

const DEFAULT_PRICE_PRO = "price_1TlmVgCZi7rHt6jVAt2thIQG";
const DEFAULT_PRICE_PRO_PLUS = "price_1TlmbGCZi7rHt6jVxuXxNGRV";

export function getStripePriceId(slug: PlanSlug): string | null {
  if (slug === PLAN_SLUGS.PRO) {
    return process.env.STRIPE_PRICE_PRO ?? DEFAULT_PRICE_PRO;
  }

  if (slug === PLAN_SLUGS.PRO_PLUS) {
    return process.env.STRIPE_PRICE_PRO_PLUS ?? DEFAULT_PRICE_PRO_PLUS;
  }

  return null;
}

export function getPlanSlugFromStripePriceId(
  priceId: string
): PlanSlug | null {
  const pro = process.env.STRIPE_PRICE_PRO ?? DEFAULT_PRICE_PRO;
  const proPlus = process.env.STRIPE_PRICE_PRO_PLUS ?? DEFAULT_PRICE_PRO_PLUS;

  if (priceId === pro) return PLAN_SLUGS.PRO;
  if (priceId === proPlus) return PLAN_SLUGS.PRO_PLUS;

  return null;
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.frizeo.ro"
  );
}

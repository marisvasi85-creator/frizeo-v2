/**
 * Frizeo marketing testimonials.
 *
 * Collect and preview on staging. Production marketing page shows the
 * section only after at least 3 approved reviews with display consent.
 */

export const MIN_APPROVED_TESTIMONIALS_FOR_PRODUCTION = 3;

function envFlag(name: string): boolean | null {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

export function isNonProductionMarketingEnv(): boolean {
  const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim();
  if (branch === "staging") return true;
  if (process.env.VERCEL_ENV === "preview") return true;
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.NODE_ENV !== "production";
}

/** Admin Recenzii + moderate API. On unless MARKETING_TESTIMONIALS_ENABLED=false. */
export function isMarketingTestimonialsEnabled(): boolean {
  const explicit = envFlag("MARKETING_TESTIMONIALS_ENABLED");
  if (explicit === false) return false;
  return true;
}

/** Public /review form. Staging/preview/dev by default. */
export function isMarketingTestimonialsCollectEnabled(): boolean {
  if (!isMarketingTestimonialsEnabled()) return false;
  const explicit = envFlag("MARKETING_TESTIMONIALS_COLLECT_ENABLED");
  if (explicit !== null) return explicit;
  return isNonProductionMarketingEnv();
}

/** Homepage testimonials section. Production only with enough approved reviews. */
export function isMarketingTestimonialsPublicEnabled(
  approvedCount: number,
): boolean {
  if (!isMarketingTestimonialsEnabled()) return false;
  const explicit = envFlag("MARKETING_TESTIMONIALS_PUBLIC_ENABLED");
  if (explicit !== null) return explicit;
  if (isNonProductionMarketingEnv()) return true;
  return approvedCount >= MIN_APPROVED_TESTIMONIALS_FOR_PRODUCTION;
}

/**
 * Frizeo marketing testimonials (public /review + homepage section).
 * Default: on for staging/preview/dev; off on production unless flagged.
 */
export function isMarketingTestimonialsEnabled(): boolean {
  const explicit = process.env.MARKETING_TESTIMONIALS_ENABLED?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;

  const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim();
  if (branch === "staging") return true;

  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "development") return true;
  return process.env.VERCEL_ENV === "preview";
}

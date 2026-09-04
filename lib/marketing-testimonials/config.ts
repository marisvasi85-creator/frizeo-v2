/**
 * Frizeo marketing testimonials (public /review + homepage section + admin Recenzii).
 * Default: on. Set MARKETING_TESTIMONIALS_ENABLED=false to hide.
 */
export function isMarketingTestimonialsEnabled(): boolean {
  const explicit = process.env.MARKETING_TESTIMONIALS_ENABLED?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;
  return true;
}

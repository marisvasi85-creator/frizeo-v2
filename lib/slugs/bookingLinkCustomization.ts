/**
 * Custom booking-link slugs in the dashboard.
 *
 * Read via process.env[name] so Next.js cannot inline a stale build-time
 * value. Vercel env changes then apply at runtime after a redeploy.
 * Default: on. Set BOOKING_LINK_CUSTOMIZATION_ENABLED=false to disable.
 */
function envFlag(name: string): boolean | null {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

export function isBookingLinkCustomizationEnabled(): boolean {
  const explicit = envFlag("BOOKING_LINK_CUSTOMIZATION_ENABLED");
  if (explicit !== null) return explicit;
  return true;
}

import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Optional shared cookie domain for www.frizeo.ro ↔ email.frizeo.ro SSO.
 * Set AUTH_COOKIE_DOMAIN=.frizeo.ro in production after DNS is ready.
 * Leave unset locally so host-only cookies keep working on localhost.
 */
export function getAuthCookieOptions(): Partial<CookieOptionsWithName> {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (!domain) return {};

  return {
    domain,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}

import type { CookieOptionsWithName } from "@supabase/ssr";
import { shouldUseStagingSupabase } from "@/lib/supabase/config";

/**
 * Optional shared cookie domain for www.frizeo.ro ↔ email.frizeo.ro SSO.
 * Set AUTH_COOKIE_DOMAIN=.frizeo.ro in production after DNS is ready.
 * Leave unset locally so host-only cookies keep working on localhost.
 * Staging must stay host-only so a staging session cannot overwrite www.
 */
export function getAuthCookieOptions(
  hostname?: string | null,
): Partial<CookieOptionsWithName> {
  if (shouldUseStagingSupabase(hostname)) {
    return {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    };
  }

  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (!domain) return {};

  return {
    domain,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}

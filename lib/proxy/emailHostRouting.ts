/**
 * Email-subdomain routing + which proxy requests need a session lookup.
 * Kept free of NextRequest so the rules can be unit-tested.
 */

import {
  isPublicEmailPath,
  isSecretAuthenticatedApiPath,
} from "@/lib/frizeo-email/publicEmailPaths";

export { isPublicEmailPath, isSecretAuthenticatedApiPath };

export type EmailHostPathAction =
  | { action: "redirect"; pathname: string }
  | { action: "rewrite"; pathname: string }
  | { action: "passthrough" };

/**
 * Path mapping for email.frizeo.ro (and local email hosts).
 * Host check happens in proxy.ts before this is called.
 */
export function emailHostPathAction(pathname: string): EmailHostPathAction {
  if (pathname === "/email" || pathname.startsWith("/email/")) {
    const stripped = pathname.slice("/email".length) || "/";
    return { action: "redirect", pathname: stripped };
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return { action: "passthrough" };
  }

  return {
    action: "rewrite",
    pathname: pathname === "/" ? "/email" : `/email${pathname}`,
  };
}

/**
 * True when proxy must call supabase.auth.getUser() and apply gates.
 * Public marketing/booking never reach proxy on www; this still skips
 * getUser on email-host public paths that only need a rewrite.
 */
export function needsSessionLookup(
  pathname: string,
  onEmailHost: boolean,
): boolean {
  if (isSecretAuthenticatedApiPath(pathname)) {
    return false;
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return true;
  }

  const onEmailApp =
    onEmailHost ||
    pathname === "/email" ||
    pathname.startsWith("/email/") ||
    pathname.startsWith("/api/email");

  return onEmailApp && !isPublicEmailPath(pathname);
}

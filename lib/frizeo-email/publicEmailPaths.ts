/**
 * Paths that must stay reachable without a platform-admin cookie.
 * Used by proxy.ts on email.frizeo.ro (and /email on www).
 */

export function isSecretAuthenticatedApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/internal/") ||
    pathname.startsWith("/api/webhooks/")
  );
}

/**
 * Email-host requests that skip the login / platform-admin redirect.
 *
 * Cron, webhooks and internal workers authenticate with their own secrets.
 * Other non-email APIs also carry their own auth and must not be gated here —
 * otherwise email.frizeo.ro/api/internal/marketing/automations 307s to /login
 * and the external cron never reaches the handler.
 */
export function isPublicEmailPath(pathname: string): boolean {
  if (pathname.startsWith("/unsubscribe")) return true;
  if (pathname.startsWith("/email/unsubscribe")) return true;
  if (pathname.startsWith("/api/email/sso")) return true;
  if (pathname.startsWith("/api/email/unsubscribe")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/email")) {
    return true;
  }
  return false;
}

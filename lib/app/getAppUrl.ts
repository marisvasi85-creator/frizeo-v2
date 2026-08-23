/**
 * App base URL for auth redirects, Stripe return URLs, etc.
 *
 * Preview: uses VERCEL_BRANCH_URL (set automatically by Vercel per branch).
 * Production: NEXT_PUBLIC_APP_URL or https://www.frizeo.ro
 */
export function getAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL.replace(/\/$/, "")}`;
  }

  if (process.env.VERCEL_ENV === "production") {
    return "https://www.frizeo.ro";
  }

  return "http://localhost:3000";
}

/** Resolve a safe same-environment dashboard origin from a public request. */
export function getAppUrlForRequest(requestUrl: string | URL): string {
  const url = new URL(requestUrl);
  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "www.frizeo.ro" ||
    hostname === "frizeo.ro" ||
    hostname === "staging.frizeo.ro" ||
    hostname.endsWith(".vercel.app") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return url.origin;
  }

  return getAppUrl();
}

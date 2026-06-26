/**
 * App base URL for auth redirects, Stripe return URLs, etc.
 *
 * Preview: uses VERCEL_BRANCH_URL (set automatically by Vercel per branch).
 * Production: NEXT_PUBLIC_APP_URL or https://www.frizeo.ro
 */
export function getAppUrl(): string {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL.replace(/\/$/, "")}`;
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (process.env.VERCEL_ENV === "production") {
    return "https://www.frizeo.ro";
  }

  return "http://localhost:3000";
}

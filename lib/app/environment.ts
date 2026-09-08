/**
 * Canonical runtime environment for Frizeo.
 *
 * Vercel:
 * - main / www.frizeo.ro / email.frizeo.ro → production
 * - staging branch / staging.frizeo.ro → staging (often VERCEL_ENV=preview)
 * - other preview deployments → preview
 * - `vercel dev` / local → development
 *
 * Staging can be assigned the Production Vercel environment, so hostname and
 * git branch are checked before VERCEL_ENV.
 */

const PRODUCTION_HOSTS = new Set([
  "www.frizeo.ro",
  "frizeo.ro",
  "email.frizeo.ro",
]);

const STAGING_HOSTS = new Set(["staging.frizeo.ro"]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "email.localhost", "email.local"]);

function envValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function envFlag(name: string): boolean {
  const value = envValue(name).toLowerCase();
  return value === "true" || value === "1";
}

export function normalizeHostname(
  hostname: string | null | undefined,
): string {
  return (hostname ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
}

export function isProductionHostname(
  hostname: string | null | undefined,
): boolean {
  return PRODUCTION_HOSTS.has(normalizeHostname(hostname));
}

export function isStagingHostname(
  hostname: string | null | undefined,
): boolean {
  return STAGING_HOSTS.has(normalizeHostname(hostname));
}

export function isPreviewHostname(
  hostname: string | null | undefined,
): boolean {
  return normalizeHostname(hostname).endsWith(".vercel.app");
}

export function isLocalHostname(
  hostname: string | null | undefined,
): boolean {
  return LOCAL_HOSTS.has(normalizeHostname(hostname));
}

function vercelEnv(): string {
  return envValue("VERCEL_ENV") || envValue("NEXT_PUBLIC_VERCEL_ENV");
}

function gitBranch(): string {
  return (
    envValue("VERCEL_GIT_COMMIT_REF") ||
    envValue("NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF")
  );
}

export function hostnameFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) return normalizeHostname(forwarded.split(",")[0]);
  const host = request.headers.get("host");
  if (host) return normalizeHostname(host);
  try {
    return normalizeHostname(new URL(request.url).hostname);
  } catch {
    return "";
  }
}

export function isDevelopment(): boolean {
  if (vercelEnv() === "development") return true;
  return !vercelEnv() && process.env.NODE_ENV === "development";
}

export function isStaging(): boolean {
  if (gitBranch() === "staging") return true;
  const appUrl = envValue("NEXT_PUBLIC_APP_URL").toLowerCase();
  if (appUrl.includes("staging.frizeo.ro")) return true;
  const vercelUrl = (
    envValue("VERCEL_URL") || envValue("NEXT_PUBLIC_VERCEL_URL")
  ).toLowerCase();
  return vercelUrl.includes("staging.frizeo.ro");
}

export function isPreview(): boolean {
  if (isStaging()) return false;
  return vercelEnv() === "preview";
}

export function isProduction(): boolean {
  if (isStaging() || isPreview() || isDevelopment()) return false;
  if (vercelEnv() === "production") return true;
  return !vercelEnv() && process.env.NODE_ENV === "production";
}

/** Search-indexable public site: www / production only. */
export function shouldIndexForSearchEngines(): boolean {
  return isProduction();
}

/**
 * Single QA switch for periodic/background work on staging + preview.
 * Production ignores this flag and always runs jobs.
 */
export function isStagingBackgroundJobsEnabled(): boolean {
  return envFlag("STAGING_BACKGROUND_JOBS_ENABLED");
}

export function isStagingAnalyticsOverrideEnabled(): boolean {
  return (
    envFlag("STAGING_ANALYTICS_ENABLED") ||
    envFlag("NEXT_PUBLIC_STAGING_ANALYTICS_ENABLED")
  );
}

function hostnameIsNonProduction(hostname: string): boolean {
  return (
    isStagingHostname(hostname) ||
    isPreviewHostname(hostname) ||
    isLocalHostname(hostname)
  );
}

/**
 * Skip cron / workers on staging and preview unless the QA flag is on.
 * Production hosts always run. Local development always runs.
 */
export function shouldSkipBackgroundJobs(request?: Request): boolean {
  if (isStagingBackgroundJobsEnabled()) return false;

  if (request) {
    const host = hostnameFromRequest(request);
    if (isProductionHostname(host)) return false;
    if (isLocalHostname(host)) return false;
    if (isStagingHostname(host) || isPreviewHostname(host)) return true;
  }

  if (isProduction() || isDevelopment()) return false;
  if (isStaging() || isPreview()) return true;
  return false;
}

/**
 * Production marketing pixels + first-party ingest.
 * Staging/preview/local are off unless an explicit analytics QA override.
 */
export function isMarketingAnalyticsEnabled(
  hostname?: string | null,
): boolean {
  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "");

  if (host) {
    if (isProductionHostname(host)) return true;
    if (hostnameIsNonProduction(host)) {
      return isStagingAnalyticsOverrideEnabled();
    }
  }

  if (isProduction()) return true;
  if (isStaging() || isPreview() || isDevelopment()) {
    return isStagingAnalyticsOverrideEnabled();
  }
  return false;
}

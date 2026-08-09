import { getAppUrl } from "@/lib/app/getAppUrl";

/** Public base URL for Frizeo Email (no trailing slash). */
export function getEmailAppUrl(): string {
  // Vercel Preview must always stay on the preview origin. The production
  // subdomain may be configured for both environments in Vercel, but sending
  // a preview session there would land on the production deployment.
  if (process.env.VERCEL_ENV === "preview") {
    return `${getAppUrl()}/email`;
  }

  const fromEnv = process.env.NEXT_PUBLIC_EMAIL_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (process.env.VERCEL_ENV === "production") {
    return "https://email.frizeo.ro";
  }

  // Local / preview: same origin path prefix.
  return `${getAppUrl()}/email`;
}

/**
 * Resolve the Email app URL from the request host.
 *
 * Preview/custom development hosts must stay on their own origin under
 * `/email`. Only the canonical Frizeo production hosts hand off to the
 * dedicated email subdomain.
 */
export function getEmailAppUrlForRequest(requestUrl: string | URL): string {
  const url = new URL(requestUrl);
  const hostname = url.hostname.toLowerCase();

  if (isEmailHost(hostname)) {
    return url.origin;
  }

  if (
    hostname === "staging.frizeo.ro" ||
    hostname.endsWith(".vercel.app") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return `${url.origin}/email`;
  }

  return getEmailAppUrl();
}

/** Main Frizeo app URL (dashboard/login redirects). */
export function getFrizeoAppUrl(): string {
  return getAppUrl();
}

export function isEmailHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  if (host === "email.frizeo.ro") return true;
  if (host === "email.localhost" || host === "email.local") return true;
  return false;
}

/** Hostnames that should serve the Frizeo Email app shell. */
export function getEmailHostnames(): string[] {
  return ["email.frizeo.ro", "email.localhost", "email.local"];
}

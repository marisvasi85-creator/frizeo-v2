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

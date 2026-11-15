import { hostnameFromRequest, isProduction } from "@/lib/app/environment";

export const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";
export const GOOGLE_BUSINESS_STAGING_REDIRECT_URI =
  "https://staging.frizeo.ro/api/integrations/google-business/callback";
export const GOOGLE_BUSINESS_PRODUCTION_REDIRECT_URI =
  "https://www.frizeo.ro/api/integrations/google-business/callback";
export const GOOGLE_BUSINESS_APEX_REDIRECT_URI =
  "https://frizeo.ro/api/integrations/google-business/callback";
export const GOOGLE_BUSINESS_REDIRECT_URI = GOOGLE_BUSINESS_STAGING_REDIRECT_URI;
export const GOOGLE_BUSINESS_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_BUSINESS_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_BUSINESS_LIVE_ENV = "GOOGLE_BUSINESS_PUBLISH_LIVE";

const REDIRECT_URIS = new Set([
  GOOGLE_BUSINESS_STAGING_REDIRECT_URI,
  GOOGLE_BUSINESS_PRODUCTION_REDIRECT_URI,
  GOOGLE_BUSINESS_APEX_REDIRECT_URI,
]);

const STORAGE_HOSTS = new Set([
  "fanxxytfuhnakfdzwssd.supabase.co",
  "shsompeyazrvswnjmlmw.supabase.co",
]);

const ACCOUNT_ID = /^accounts\/[0-9]{1,30}$/;
const LOCATION_ID = /^accounts\/[0-9]{1,30}\/locations\/[0-9]{1,30}$/;
const POST_ID = /^accounts\/[0-9]{1,30}\/locations\/[0-9]{1,30}\/localPosts\/[A-Za-z0-9_-]{1,128}$/;
const META_POST_ID = /^[0-9]{1,32}(?:_[0-9]{1,32})?$/;

export type GoogleBusinessConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: typeof GOOGLE_BUSINESS_SCOPE;
};

export function googleBusinessLiveEnvEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[GOOGLE_BUSINESS_LIVE_ENV]?.trim() === "true";
}

function encryptionKeyReady(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}

export function googleBusinessRedirectUri(
  env: Record<string, string | undefined>,
  production: boolean,
): string | null {
  const configured = env.GOOGLE_BUSINESS_REDIRECT_URI?.trim() ?? "";
  const redirect = configured || (production
    ? GOOGLE_BUSINESS_PRODUCTION_REDIRECT_URI
    : GOOGLE_BUSINESS_STAGING_REDIRECT_URI);
  if (!REDIRECT_URIS.has(redirect)) return null;
  if (production && redirect === GOOGLE_BUSINESS_STAGING_REDIRECT_URI) return null;
  if (!production && redirect !== GOOGLE_BUSINESS_STAGING_REDIRECT_URI) return null;
  return redirect;
}

export function googleStorageHost(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return STORAGE_HOSTS.has(host) ? host : null;
  } catch {
    return null;
  }
}

export function googlePublishHostAllowed(host: string, production: boolean): boolean {
  if (production) return host === "www.frizeo.ro" || host === "frizeo.ro";
  return host === "staging.frizeo.ro";
}

export function googlePublishOriginAllowed(request: Request, production: boolean): boolean {
  const host = hostnameFromRequest(request);
  if (!googlePublishHostAllowed(host, production)) return false;
  if (request.headers.get("origin") !== `https://${host}`) return false;
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin";
}

export function assertGoogleBusinessConfig(
  env: Record<string, string | undefined>,
  options: { production: boolean },
): { ok: true; config: GoogleBusinessConfig } | { ok: false; reason: "unconfigured" } {
  const clientId = env.GOOGLE_BUSINESS_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim() ?? "";
  const calendarClientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const redirectUri = googleBusinessRedirectUri(env, options.production);
  if (!clientId || !clientSecret || !redirectUri || !encryptionKeyReady(env.INTEGRATION_TOKEN_ENCRYPTION_KEY)) {
    return { ok: false, reason: "unconfigured" };
  }
  if (calendarClientId && clientId === calendarClientId) {
    return { ok: false, reason: "unconfigured" };
  }
  if (!googleStorageHost(env)) return { ok: false, reason: "unconfigured" };
  return {
    ok: true,
    config: {
      clientId,
      clientSecret,
      redirectUri,
      scope: GOOGLE_BUSINESS_SCOPE,
    },
  };
}

export function googleBusinessConfigured(): boolean {
  return assertGoogleBusinessConfig(process.env, { production: isProduction() }).ok;
}

export function isGoogleAccountName(value: string): boolean {
  return ACCOUNT_ID.test(value);
}

export function isGoogleLocationId(value: string): boolean {
  return LOCATION_ID.test(value);
}

export function isGooglePostId(value: string): boolean {
  return POST_ID.test(value);
}

export function isMetaPostId(value: string): boolean {
  return META_POST_ID.test(value);
}

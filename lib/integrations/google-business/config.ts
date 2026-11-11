import { isProduction } from "@/lib/app/environment";

export const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";
export const GOOGLE_BUSINESS_REDIRECT_URI =
  "https://staging.frizeo.ro/api/integrations/google-business/callback";
export const GOOGLE_BUSINESS_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_BUSINESS_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_BUSINESS_LIVE_ENV = "GOOGLE_BUSINESS_PUBLISH_LIVE";

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

export function assertGoogleBusinessConfig(
  env: Record<string, string | undefined>,
  options: { production: boolean },
): { ok: true; config: GoogleBusinessConfig } | { ok: false; reason: "production" | "unconfigured" } {
  if (options.production) return { ok: false, reason: "production" };
  const clientId = env.GOOGLE_BUSINESS_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim() ?? "";
  const calendarClientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  if (!clientId || !clientSecret || !encryptionKeyReady(env.INTEGRATION_TOKEN_ENCRYPTION_KEY)) {
    return { ok: false, reason: "unconfigured" };
  }
  if (calendarClientId && clientId === calendarClientId) {
    return { ok: false, reason: "unconfigured" };
  }
  return {
    ok: true,
    config: {
      clientId,
      clientSecret,
      redirectUri: GOOGLE_BUSINESS_REDIRECT_URI,
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

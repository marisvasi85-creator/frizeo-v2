import { isProduction } from "@/lib/app/environment";

export const TIKTOK_SCOPE = "user.info.basic";
export const TIKTOK_REDIRECT_URI =
  "https://staging.frizeo.ro/api/integrations/tiktok/callback";
export const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";

const OPEN_ID = /^[A-Za-z0-9._-]{2,128}$/;

export type TikTokConfig = {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  scope: typeof TIKTOK_SCOPE;
};

function encryptionKeyReady(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}

export function assertTikTokConfig(
  env: Record<string, string | undefined>,
  options: { production: boolean },
): { ok: true; config: TikTokConfig } | { ok: false; reason: "production" | "unconfigured" } {
  if (options.production) return { ok: false, reason: "production" };
  const clientKey = env.TIKTOK_CLIENT_KEY?.trim() ?? "";
  const clientSecret = env.TIKTOK_CLIENT_SECRET?.trim() ?? "";
  if (!clientKey || !clientSecret || !encryptionKeyReady(env.INTEGRATION_TOKEN_ENCRYPTION_KEY)) {
    return { ok: false, reason: "unconfigured" };
  }
  return {
    ok: true,
    config: {
      clientKey,
      clientSecret,
      redirectUri: TIKTOK_REDIRECT_URI,
      scope: TIKTOK_SCOPE,
    },
  };
}

export function tikTokConfigured(): boolean {
  return assertTikTokConfig(process.env, { production: isProduction() }).ok;
}

export function isTikTokOpenId(value: string): boolean {
  return OPEN_ID.test(value);
}

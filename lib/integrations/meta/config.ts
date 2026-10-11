export const META_GRAPH_VERSION = "v26.0";
export const META_APP_ID = "2094935131390397";
export const META_LOGIN_CONFIGURATION_ID = "2325264384883936";
export const META_OAUTH_REDIRECT_URI =
  "https://staging.frizeo.ro/api/integrations/meta/callback";

export const META_REQUIRED_SCOPES = [
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "pages_read_engagement",
  "pages_show_list",
] as const;

export type MetaReadyConfig = {
  appId: string;
  appSecret: string;
  configurationId: string;
  redirectUri: string;
};

export type MetaConfigFailure =
  | "meta_unconfigured"
  | "meta_disabled_in_production";

export function assertMetaConfig(
  env: Record<string, string | undefined>,
  runtime: { production: boolean },
): { ok: true; config: MetaReadyConfig } | { ok: false; reason: MetaConfigFailure } {
  if (runtime.production) return { ok: false, reason: "meta_disabled_in_production" };

  const appId = env.META_APP_ID?.trim() ?? "";
  const appSecret = env.META_APP_SECRET?.trim() ?? "";
  const configurationId = env.META_LOGIN_CONFIGURATION_ID?.trim() ?? "";
  const redirectUri = env.META_OAUTH_REDIRECT_URI?.trim() ?? "";
  const encryptionReady = encryptionKeyConfigured(env.INTEGRATION_TOKEN_ENCRYPTION_KEY);

  if (
    !encryptionReady ||
    appId !== META_APP_ID ||
    configurationId !== META_LOGIN_CONFIGURATION_ID ||
    redirectUri !== META_OAUTH_REDIRECT_URI ||
    appSecret.length === 0
  ) {
    return { ok: false, reason: "meta_unconfigured" };
  }

  return {
    ok: true,
    config: { appId, appSecret, configurationId, redirectUri },
  };
}

function encryptionKeyConfigured(raw: string | undefined): boolean {
  if (!raw?.trim()) return false;
  try {
    return Buffer.from(raw.trim(), "base64").length === 32;
  } catch {
    return false;
  }
}

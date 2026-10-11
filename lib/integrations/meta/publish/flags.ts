import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import { hostnameFromRequest, isProduction } from "@/lib/app/environment";

export const META_PUBLISH_LIVE_ENV = "META_PUBLISH_LIVE";
export const STAGING_PUBLISH_ORIGIN = "https://staging.frizeo.ro";
export const STAGING_PUBLISH_HOST = "staging.frizeo.ro";
export const STAGING_SUPABASE_HOST = "fanxxytfuhnakfdzwssd.supabase.co";
export const MARKETING_PUBLISH_BUCKET = "marketing-publish";

export type PublishAction = "media" | "mock" | "live" | "verify" | "cleanup" | "release";

export type PublishDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404; error: string };

export function metaPublishLiveEnvEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[META_PUBLISH_LIVE_ENV]?.trim() === "true";
}

export function publishOriginAllowed(request: Request): boolean {
  if (request.headers.get("origin") !== STAGING_PUBLISH_ORIGIN) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  return true;
}

export function publishHostAllowed(request: Request): boolean {
  return hostnameFromRequest(request) === STAGING_PUBLISH_HOST;
}

/**
 * Fail closed. Live Graph calls need every gate. Mock, upload, cleanup, and
 * ambiguous release do not call Graph and do not require the live kill switch.
 */
export function publishRequestDecision(input: {
  production: boolean;
  hostIsStaging: boolean;
  originAllowed: boolean;
  authenticated: boolean;
  role: string | null;
  integrationEnabled: boolean;
  liveCapabilityEnabled: boolean;
  envLiveEnabled: boolean;
  configured: boolean;
  action: PublishAction;
}): PublishDecision {
  if (input.production || !input.hostIsStaging) {
    return { ok: false, status: 404, error: "not_configured" };
  }
  if (!input.originAllowed) return { ok: false, status: 403, error: "origin" };
  if (!input.authenticated) return { ok: false, status: 401, error: "unauthenticated" };
  if (!canAdministerIntegrations(input.role)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (!input.integrationEnabled) {
    return { ok: false, status: 403, error: "capability_off" };
  }
  if (input.action === "live" || input.action === "verify") {
    if (!input.liveCapabilityEnabled || !input.envLiveEnabled) {
      return { ok: false, status: 403, error: "live_off" };
    }
    if (!input.configured) return { ok: false, status: 403, error: "unconfigured" };
  }
  return { ok: true };
}

export function livePublishAllowed(input: {
  production: boolean;
  hostIsStaging: boolean;
  integrationEnabled: boolean;
  liveCapabilityEnabled: boolean;
  envLiveEnabled: boolean;
  configured: boolean;
}): boolean {
  return (
    !input.production &&
    input.hostIsStaging &&
    input.integrationEnabled &&
    input.liveCapabilityEnabled &&
    input.envLiveEnabled &&
    input.configured
  );
}

export async function loadPublishFlags(tenantId: string, readEnabled: (
  tenantId: string,
  capability: "marketing.publish.meta" | "marketing.publish.meta.live",
) => Promise<boolean>): Promise<{
  integrationEnabled: boolean;
  liveCapabilityEnabled: boolean;
  envLiveEnabled: boolean;
}> {
  const [integrationEnabled, liveCapabilityEnabled] = await Promise.all([
    readEnabled(tenantId, "marketing.publish.meta"),
    readEnabled(tenantId, "marketing.publish.meta.live"),
  ]);
  return {
    integrationEnabled,
    liveCapabilityEnabled,
    envLiveEnabled: metaPublishLiveEnvEnabled(),
  };
}

export function requestIsProduction(): boolean {
  return isProduction();
}

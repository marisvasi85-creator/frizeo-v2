import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import type { TikTokHttp } from "@/lib/integrations/tiktok/api";
import { initTikTokPhotoInbox, type TikTokPostError } from "@/lib/integrations/tiktok/posting";

export const TIKTOK_DRAFT_TEST_ENV = "TIKTOK_DRAFT_TEST";
export const DEMO_BARBER_TENANT_ID = "5d9862a1-fd85-46f2-9c7e-635e813e067c";

export function tikTokDraftTestEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[TIKTOK_DRAFT_TEST_ENV]?.trim() === "true";
}

export type DraftAccess =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403 | 404;
      error: "not_configured" | "unauthenticated" | "forbidden" | "gate_off" | "unconfigured";
    };

export function decideTikTokDraftAccess(input: {
  production: boolean;
  stagingHost: boolean;
  authenticated: boolean;
  role: string | null;
  tenantId: string | null;
  userId: string | null;
  connectedBy: string | null;
  configured: boolean;
  gateEnabled: boolean;
}): DraftAccess {
  if (input.production || !input.stagingHost) {
    return { ok: false, status: 404, error: "not_configured" };
  }
  if (!input.authenticated || !input.userId || !input.tenantId) {
    return { ok: false, status: 401, error: "unauthenticated" };
  }
  if (input.tenantId !== DEMO_BARBER_TENANT_ID || !canAdministerIntegrations(input.role)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (!input.connectedBy || input.userId !== input.connectedBy) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (!input.configured) return { ok: false, status: 403, error: "unconfigured" };
  if (!input.gateEnabled) return { ok: false, status: 403, error: "gate_off" };
  return { ok: true };
}

export type DraftClaim =
  | { outcome: "claimed"; jobId: string }
  | {
      outcome: "replay" | "conflict" | "busy" | "upload_scope_required" | "connection_missing" | "invalid" | "forbidden_tenant" | "direct_post_inactive";
      jobId?: string;
      status?: string;
      publishId?: string | null;
    };

export type DraftSettle =
  | { kind: "success"; publishId: string }
  | { kind: "ambiguous" }
  | { kind: "rejected"; safeError: string };

export function safeDraftError(reason: TikTokPostError): string {
  if (reason === "rate_limited") return "rate_limited";
  if (reason === "invalid_media") return "invalid_media";
  if (reason === "invalid_caption") return "invalid_caption";
  if (reason === "upload_scope_required") return "upload_scope_required";
  return "provider_error";
}

export async function performTikTokDraftTest(input: {
  access: DraftAccess;
  caption: string;
  mediaObjectPath: string;
  http: TikTokHttp;
  claim: () => Promise<DraftClaim>;
  createGrant: (objectPath: string) => Promise<{ imageUrl: string } | null>;
  loadToken: () => Promise<{ accessToken: string; scopes: string[] } | null>;
  settle: (jobId: string, patch: DraftSettle) => Promise<boolean>;
}): Promise<{
  error?: string;
  outcome?: string;
  jobId?: string;
  publishId?: string | null;
  externalCall: boolean;
  attempts: number;
}> {
  if (!input.access.ok) {
    return { error: input.access.error, externalCall: false, attempts: 0 };
  }
  const claimed = await input.claim();
  if (claimed.outcome !== "claimed") {
    return {
      outcome: claimed.outcome,
      jobId: claimed.jobId,
      publishId: claimed.publishId ?? null,
      externalCall: false,
      attempts: 0,
    };
  }
  const grant = await input.createGrant(input.mediaObjectPath);
  const token = grant ? await input.loadToken() : null;
  if (!grant || !token) {
    await input.settle(claimed.jobId, {
      kind: "rejected",
      safeError: grant ? "token_unavailable" : "invalid_media",
    });
    return {
      outcome: "rejected",
      jobId: claimed.jobId,
      externalCall: false,
      attempts: 0,
    };
  }
  const result = await initTikTokPhotoInbox({
    http: input.http,
    accessToken: token.accessToken,
    scopes: token.scopes,
    capabilityEnabled: false,
    draftTest: true,
    liveEnabled: true,
    maxAttempts: 1,
    caption: input.caption,
    imageUrl: grant.imageUrl,
  });
  if (result.ok) {
    const saved = await input.settle(claimed.jobId, { kind: "success", publishId: result.publishId });
    return {
      outcome: saved ? "initiated" : "needs_reconcile",
      jobId: claimed.jobId,
      publishId: result.publishId,
      externalCall: true,
      attempts: result.attempts,
    };
  }
  if (result.ambiguous) {
    await input.settle(claimed.jobId, { kind: "ambiguous" });
    return {
      outcome: "needs_reconcile",
      jobId: claimed.jobId,
      externalCall: result.externalCall,
      attempts: result.attempts,
    };
  }
  await input.settle(claimed.jobId, { kind: "rejected", safeError: safeDraftError(result.reason) });
  return {
    outcome: "rejected",
    jobId: claimed.jobId,
    externalCall: result.externalCall,
    attempts: result.attempts,
  };
}

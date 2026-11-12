import {
  TIKTOK_PUBLISH_SCOPE,
  TIKTOK_SCOPE,
  TIKTOK_UPLOAD_SCOPE,
} from "@/lib/integrations/tiktok/config";
import { redactTikTokErrorMessage } from "@/lib/integrations/tiktok/flow";
import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import type { TikTokHttp } from "@/lib/integrations/tiktok/api";
import { TIKTOK_STATUS_URL } from "@/lib/integrations/tiktok/posting";
import { DEMO_BARBER_TENANT_ID } from "@/lib/integrations/tiktok/draftTest";

export const TIKTOK_KNOWN_STATUS_PUBLISH_ID = "p_inbox_url~v2.7707199245161351190";
export const TIKTOK_KNOWN_STATUS_JOB_ID = "b973614b-d043-4c70-8d24-8f84575b9b21";
export const TIKTOK_KNOWN_STATUS_IDEMPOTENCY_KEY = "draft-jpeg-frizeo-app-02";

const SAFE_CODE = /^[a-z0-9_]{1,64}$/;
const SAFE_STATUS = /^[A-Z0-9_]{1,40}$/;

export type StatusAccess =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403 | 404;
      error: "not_configured" | "unauthenticated" | "forbidden" | "unconfigured";
    };

export function decideTikTokStatusAccess(input: {
  production: boolean;
  stagingHost: boolean;
  authenticated: boolean;
  role: string | null;
  tenantId: string | null;
  userId: string | null;
  connectedBy: string | null;
  configured: boolean;
}): StatusAccess {
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
  return { ok: true };
}

export function requestedKnownPublishId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { publishId?: unknown; publish_id?: unknown };
  if (typeof record.publishId !== "string") return null;
  if (record.publish_id !== undefined && record.publish_id !== record.publishId) return null;
  return record.publishId === TIKTOK_KNOWN_STATUS_PUBLISH_ID ? record.publishId : null;
}

export type KnownTikTokStatusJob = {
  id: string;
  tenantId: string;
  provider: string;
  idempotencyKey: string | null;
  destinationTenantId: string;
  destinationProvider: string;
  destinationConnectionId: string;
  connectionId: string;
  providerPostId: string | null;
};

export function knownTikTokStatusJobMatches(
  job: KnownTikTokStatusJob | null,
  tenantId: string,
): boolean {
  if (!job || tenantId !== DEMO_BARBER_TENANT_ID) return false;
  const savedId = job.providerPostId;
  const savedIdMatches = savedId === null || savedId === TIKTOK_KNOWN_STATUS_PUBLISH_ID;
  return job.id === TIKTOK_KNOWN_STATUS_JOB_ID
    && job.tenantId === tenantId
    && job.provider === "tiktok"
    && job.idempotencyKey === TIKTOK_KNOWN_STATUS_IDEMPOTENCY_KEY
    && job.destinationTenantId === tenantId
    && job.destinationProvider === "tiktok"
    && job.destinationConnectionId.length > 0
    && job.destinationConnectionId === job.connectionId
    && savedIdMatches;
}

function safeCode(value: unknown): string | null {
  return typeof value === "string" && SAFE_CODE.test(value) ? value : null;
}

function safeStatus(value: unknown): string | null {
  return typeof value === "string" && SAFE_STATUS.test(value) ? value : null;
}

export type KnownStatusResult = {
  error?: string;
  externalCall: boolean;
  httpStatus?: number;
  tikTokCode?: string | null;
  status?: string | null;
  failReason?: string | null;
  tikTokMessage?: string | null;
  saved?: boolean;
};

export function tikTokStatusRecord(input: {
  status: string | null;
  failReason: string | null;
}): { status: "failed" | "pending" | "published"; safeError: string | null } | null {
  if (input.status === "FAILED") {
    const safeError = input.failReason && /^[a-z0-9_]{1,64}$/.test(input.failReason)
      ? input.failReason
      : "provider_error";
    return { status: "failed", safeError };
  }
  if (input.status === "PUBLISH_COMPLETE") return { status: "published", safeError: null };
  if (
    input.status === "SEND_TO_USER_INBOX"
    || input.status === "PROCESSING_DOWNLOAD"
    || input.status === "PROCESSING_UPLOAD"
  ) {
    return { status: "pending", safeError: null };
  }
  return null;
}

export async function fetchKnownTikTokDraftStatus(input: {
  http: TikTokHttp;
  accessToken: string;
  publishId: string;
}): Promise<KnownStatusResult> {
  if (input.publishId !== TIKTOK_KNOWN_STATUS_PUBLISH_ID || !input.accessToken) {
    return { error: "unknown_publish_id", externalCall: false };
  }
  let response: { status: number; body: unknown };
  try {
    response = await input.http({
      url: TIKTOK_STATUS_URL,
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publish_id: TIKTOK_KNOWN_STATUS_PUBLISH_ID }),
    });
  } catch {
    console.error(JSON.stringify({
      source: "tiktok_known_status",
      httpStatus: null,
      tikTokCode: null,
      status: null,
      failReason: null,
    }));
    return { error: "network", externalCall: true };
  }
  const record = response.body && typeof response.body === "object"
    ? response.body as {
        data?: { status?: unknown; fail_reason?: unknown };
        error?: { code?: unknown; message?: unknown };
      }
    : null;
  const tikTokCode = safeCode(record?.error?.code);
  const status = safeStatus(record?.data?.status);
  const failReason = safeCode(record?.data?.fail_reason);
  const tikTokMessage = redactTikTokErrorMessage(
    typeof record?.error?.message === "string" ? record.error.message : null,
    input.accessToken,
  );
  console.error(JSON.stringify({
    source: "tiktok_known_status",
    httpStatus: response.status,
    tikTokCode,
    status,
    failReason,
  }));
  return {
    externalCall: true,
    httpStatus: response.status,
    tikTokCode,
    status,
    failReason,
    tikTokMessage,
  };
}

export async function performKnownTikTokStatusCheck(input: {
  access: StatusAccess;
  publishId: string | null;
  http: TikTokHttp;
  readJob: () => Promise<KnownTikTokStatusJob | null>;
  readScopes: () => string[] | null;
  loadToken: () => Promise<string | null>;
  recordStatus?: (record: { status: "failed" | "pending" | "published"; safeError: string | null }) => Promise<boolean>;
}): Promise<KnownStatusResult> {
  if (!input.access.ok) {
    return { error: input.access.error, externalCall: false };
  }
  if (input.publishId !== TIKTOK_KNOWN_STATUS_PUBLISH_ID) {
    return { error: "unknown_publish_id", externalCall: false };
  }
  const job = await input.readJob();
  if (!knownTikTokStatusJobMatches(job, DEMO_BARBER_TENANT_ID)) {
    return { error: "job_mismatch", externalCall: false };
  }
  const scopes = input.readScopes();
  if (!scopes) return { error: "token_unavailable", externalCall: false };
  if (scopes.includes(TIKTOK_PUBLISH_SCOPE)) {
    return { error: "direct_post_inactive", externalCall: false };
  }
  if (!scopes.includes(TIKTOK_SCOPE) || !scopes.includes(TIKTOK_UPLOAD_SCOPE)) {
    return { error: "scope_not_authorized", externalCall: false };
  }
  const accessToken = await input.loadToken();
  if (!accessToken) return { error: "token_unavailable", externalCall: false };
  const result = await fetchKnownTikTokDraftStatus({
    http: input.http,
    accessToken,
    publishId: input.publishId,
  });
  const record = tikTokStatusRecord({
    status: result.status ?? null,
    failReason: result.failReason ?? null,
  });
  if (!result.externalCall || !record || !input.recordStatus) return result;
  const saved = await input.recordStatus(record);
  return { ...result, saved };
}

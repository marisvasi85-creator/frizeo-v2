import { NextResponse } from "next/server";
import { hostnameFromRequest, isProduction, isStagingHostname } from "@/lib/app/environment";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import { assertTikTokConfig } from "@/lib/integrations/tiktok/config";
import { createTikTokHttp } from "@/lib/integrations/tiktok/api";
import { DEMO_BARBER_TENANT_ID } from "@/lib/integrations/tiktok/draftTest";
import {
  decideTikTokStatusAccess,
  performKnownTikTokStatusCheck,
  requestedKnownPublishId,
  TIKTOK_KNOWN_STATUS_JOB_ID,
  TIKTOK_KNOWN_STATUS_PUBLISH_ID,
  type KnownStatusResult,
} from "@/lib/integrations/tiktok/statusCheck";
import {
  openTikTokDraftAccessToken,
  readKnownTikTokStatusJob,
  readTikTokDraftConnection,
  reconcileTikTokDraftStatus,
} from "@/lib/integrations/tiktok/store";

function statusCode(result: KnownStatusResult): number {
  if (result.error === "not_configured") return 404;
  if (result.error === "unauthenticated") return 401;
  if (result.error === "unknown_publish_id") return 400;
  if (result.error === "network") return 502;
  if (result.error) return 403;
  return 200;
}

export async function readKnownTikTokDraftStatus(request: Request) {
  if (isProduction() || !isStagingHostname(hostnameFromRequest(request))) {
    return NextResponse.json({ error: "not_configured", externalCall: false }, { status: 404 });
  }
  const session = await getAdminSession();
  const secret = session?.tenantId === DEMO_BARBER_TENANT_ID && canAdministerIntegrations(session.role)
    ? await readTikTokDraftConnection(session.tenantId)
    : null;
  const access = decideTikTokStatusAccess({
    production: false,
    stagingHost: true,
    authenticated: Boolean(session?.user && session.tenantId),
    role: session?.role ?? null,
    tenantId: session?.tenantId ?? null,
    userId: session?.user.id ?? null,
    connectedBy: secret && secret.ok ? secret.connectedBy : null,
    configured: assertTikTokConfig(process.env, { production: false }).ok,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error, externalCall: false }, { status: access.status });
  }
  const body = await request.json().catch(() => null);
  const publishId = requestedKnownPublishId(body);
  const result = await performKnownTikTokStatusCheck({
    access,
    publishId,
    http: createTikTokHttp(),
    readJob: () => readKnownTikTokStatusJob(DEMO_BARBER_TENANT_ID),
    readScopes: () => secret?.ok ? secret.scopes : null,
    loadToken: async () => {
      if (!secret?.ok) return null;
      return openTikTokDraftAccessToken(secret.ciphertext, secret.nonce);
    },
    recordStatus: (record) => reconcileTikTokDraftStatus({
      tenantId: DEMO_BARBER_TENANT_ID,
      jobId: TIKTOK_KNOWN_STATUS_JOB_ID,
      publishId: TIKTOK_KNOWN_STATUS_PUBLISH_ID,
      status: record.status,
      safeError: record.safeError,
    }),
  });
  const payload: KnownStatusResult = {
    externalCall: result.externalCall,
    ...(result.error ? { error: result.error } : {}),
    ...(result.httpStatus !== undefined ? { httpStatus: result.httpStatus } : {}),
    ...(result.tikTokCode !== undefined ? { tikTokCode: result.tikTokCode } : {}),
    ...(result.status !== undefined ? { status: result.status } : {}),
    ...(result.failReason !== undefined ? { failReason: result.failReason } : {}),
    ...(result.tikTokMessage ? { tikTokMessage: result.tikTokMessage } : {}),
    ...(result.saved !== undefined ? { saved: result.saved } : {}),
  };
  return NextResponse.json(payload, { status: statusCode(result) });
}

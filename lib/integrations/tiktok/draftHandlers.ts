import { NextResponse } from "next/server";
import { hostnameFromRequest, isProduction, isStagingHostname } from "@/lib/app/environment";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import { assertTikTokConfig } from "@/lib/integrations/tiktok/config";
import {
  DEMO_BARBER_TENANT_ID,
  decideTikTokDraftAccess,
  performTikTokDraftTest,
  tikTokDraftTestEnabled,
  type DraftClaim,
} from "@/lib/integrations/tiktok/draftTest";
import {
  TIKTOK_MEDIA_TTL_MS,
  createMediaToken,
  draftImageUrl,
  hashMediaToken,
  mediaObjectPath,
} from "@/lib/integrations/tiktok/mediaGrant";
import { createTikTokHttp } from "@/lib/integrations/tiktok/api";
import {
  claimTikTokDraft,
  insertTikTokMediaGrant,
  openTikTokDraftAccessToken,
  readTikTokDraftConnection,
  settleTikTokDraft,
} from "@/lib/integrations/tiktok/store";
import { enforceRateLimit } from "@/lib/security/rateLimit";

function claimFrom(row: Record<string, unknown> | null): DraftClaim {
  const outcome = typeof row?.outcome === "string" ? row.outcome : "invalid";
  const jobId = typeof row?.job_id === "string" ? row.job_id : undefined;
  const publishId = typeof row?.publish_id === "string" ? row.publish_id : null;
  if (outcome === "claimed" && jobId) return { outcome: "claimed", jobId };
  if (
    outcome === "replay"
    || outcome === "conflict"
    || outcome === "busy"
    || outcome === "upload_scope_required"
    || outcome === "connection_missing"
    || outcome === "forbidden_tenant"
    || outcome === "direct_post_inactive"
    || outcome === "invalid"
  ) {
    return { outcome, jobId, publishId };
  }
  return { outcome: "invalid" };
}

export async function startTikTokDraftTest(request: Request) {
  if (isProduction() || !isStagingHostname(hostnameFromRequest(request))) {
    return NextResponse.json({ error: "not_configured", externalCall: false }, { status: 404 });
  }
  const session = await getAdminSession();
  const secret = session?.tenantId === DEMO_BARBER_TENANT_ID && canAdministerIntegrations(session.role)
    ? await readTikTokDraftConnection(session.tenantId)
    : null;
  const access = decideTikTokDraftAccess({
    production: false,
    stagingHost: true,
    authenticated: Boolean(session?.user && session.tenantId),
    role: session?.role ?? null,
    tenantId: session?.tenantId ?? null,
    userId: session?.user.id ?? null,
    connectedBy: secret && secret.ok ? secret.connectedBy : null,
    configured: assertTikTokConfig(process.env, { production: false }).ok,
    gateEnabled: tikTokDraftTestEnabled(),
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error, externalCall: false }, { status: access.status });
  }
  const limited = await enforceRateLimit(request, {
    bucket: "tiktok-draft-test",
    limit: 5,
    windowSeconds: 600,
    identifier: session?.user.id ?? "anonymous",
  });
  if (limited) return limited;
  const body = await request.json().catch(() => null) as {
    idempotencyKey?: unknown;
    caption?: unknown;
    mediaObjectPath?: unknown;
  } | null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  const caption = typeof body?.caption === "string" ? body.caption : "";
  const mediaObjectPathValue = typeof body?.mediaObjectPath === "string" ? body.mediaObjectPath : "";
  const objectPath = mediaObjectPath(DEMO_BARBER_TENANT_ID, mediaObjectPathValue);
  if (!session?.user || !/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey) || !caption.trim() || !objectPath) {
    return NextResponse.json({ error: "invalid", externalCall: false }, { status: 400 });
  }
  const userId = session.user.id;

  const result = await performTikTokDraftTest({
    access,
    caption,
    mediaObjectPath: objectPath,
    http: createTikTokHttp(),
    claim: async () => claimFrom(await claimTikTokDraft({
      tenantId: DEMO_BARBER_TENANT_ID,
      userId,
      idempotencyKey,
      caption,
      mediaObjectPath: objectPath,
    })),
    createGrant: async (path) => {
      const token = createMediaToken();
      const imageUrl = draftImageUrl(token);
      if (!imageUrl) return null;
      const stored = await insertTikTokMediaGrant({
        tenantId: DEMO_BARBER_TENANT_ID,
        tokenHash: hashMediaToken(token),
        objectPath: path,
        expiresAt: new Date(Date.now() + TIKTOK_MEDIA_TTL_MS).toISOString(),
      });
      return stored ? { imageUrl } : null;
    },
    loadToken: async () => {
      if (!secret?.ok) return null;
      const accessToken = openTikTokDraftAccessToken(secret.ciphertext, secret.nonce);
      return accessToken ? { accessToken, scopes: secret.scopes } : null;
    },
    settle: (jobId, patch) => settleTikTokDraft({
      tenantId: DEMO_BARBER_TENANT_ID,
      jobId,
      kind: patch.kind,
      publishId: patch.kind === "success" ? patch.publishId : null,
      safeError: patch.kind === "rejected" ? patch.safeError : null,
    }),
  });
  const status = result.error === "invalid" ? 400 : 200;
  return NextResponse.json(result, { status });
}

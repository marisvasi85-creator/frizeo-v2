import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { isProduction } from "@/lib/app/environment";
import { assertMetaConfig } from "@/lib/integrations/meta/config";
import { assessStoredTokenExpiry } from "@/lib/integrations/meta/flow";
import { createGraphBudget } from "@/lib/integrations/meta/graph";
import { metaRateLimit } from "@/lib/integrations/meta/http";
import { readMetaAccessToken } from "@/lib/integrations/meta/store";
import {
  loadPublishFlags,
  MARKETING_PUBLISH_BUCKET,
  publishHostAllowed,
  publishOriginAllowed,
  publishRequestDecision,
  type PublishAction,
} from "@/lib/integrations/meta/publish/flags";
import { createMetaPublishHttp } from "@/lib/integrations/meta/publish/graphHttp";
import {
  isMetaFetchableImageUrl,
  marketingImagePath,
  pathBelongsToTenant,
  prepareMarketingImage,
  validateCaption,
} from "@/lib/integrations/meta/publish/image";
import { advancePublishJobs } from "@/lib/integrations/meta/publish/orchestrate";
import {
  claimPublishJob,
  clearPublishMedia,
  preparePublishJobs,
  publicJobResponse,
  readPublishJob,
  readPublishMediaCandidate,
  releaseAmbiguousPublishJob,
  settlePublishJob,
  type PublicPublishJob,
} from "@/lib/integrations/meta/publish/store";
import { supabaseAdmin } from "@/lib/supabase/admin";

const KEY_RE = /^[A-Za-z0-9_-]{16,80}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function blocked(request: Request): NextResponse | null {
  if (isProduction() || !publishHostAllowed(request)) return json("not_configured", 404);
  if (!publishOriginAllowed(request)) return json("origin", 403);
  return null;
}

async function capabilityEnabled(
  tenantId: string,
  capability: "marketing.publish.meta" | "marketing.publish.meta.live",
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("tenant_capabilities")
    .select("enabled")
    .eq("tenant_id", tenantId)
    .eq("capability", capability)
    .maybeSingle();
  if (error || !data) return false;
  return data.enabled === true;
}

async function authorize(request: Request, action: PublishAction) {
  const early = blocked(request);
  if (early) return { response: early };
  const session = await getAdminSession();
  const limited = await metaRateLimit(
    request,
    `meta-publish-${action}`,
    session?.user.id ?? "anonymous",
  );
  if (limited) return { response: limited };
  const tenantId = session?.tenantId ?? "";
  const flags = tenantId
    ? await loadPublishFlags(tenantId, capabilityEnabled)
    : { integrationEnabled: false, liveCapabilityEnabled: false, envLiveEnabled: false };
  const configured = assertMetaConfig(process.env, { production: isProduction() }).ok;
  const decision = publishRequestDecision({
    production: isProduction(),
    hostIsStaging: publishHostAllowed(request),
    originAllowed: publishOriginAllowed(request),
    authenticated: Boolean(session?.user && session.tenantId),
    role: session?.role ?? null,
    integrationEnabled: flags.integrationEnabled,
    liveCapabilityEnabled: flags.liveCapabilityEnabled,
    envLiveEnabled: flags.envLiveEnabled,
    configured,
    action,
  });
  if (!decision.ok) return { response: json(decision.error, decision.status) };
  if (!session?.user || !session.tenantId) return { response: json("unauthenticated", 401) };
  const actor = {
    userId: session.user.id,
    tenantId: session.tenantId,
    role: session.role,
  };
  return { actor, flags, configured };
}

function destinationIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return null;
  const ids = value.map((item) => (typeof item === "string" ? item.toLowerCase() : ""));
  if (ids.some((id) => !UUID_RE.test(id))) return null;
  if (new Set(ids).size !== ids.length) return null;
  return ids;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) return null;
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function mergeJob(job: PublicPublishJob, state: {
  status: PublicPublishJob["status"];
  attempts: number;
  providerPostId: string | null;
  providerContainerId: string | null;
  safeError: string | null;
}): PublicPublishJob {
  return { ...job, ...state };
}

export async function publishMedia(request: Request) {
  const gate = await authorize(request, "media");
  if ("response" in gate) return gate.response;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json("invalid_image", 400);
  }
  const file = form.get("image");
  if (!(file instanceof File)) return json("invalid_image", 400);
  if (file.size <= 0 || file.size > 8_388_608) return json("invalid_image", 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  const prepared = await prepareMarketingImage(bytes);
  if (!prepared.ok) return json(prepared.reason, 400);
  const path = marketingImagePath(gate.actor.tenantId, crypto.randomUUID());
  if (!path || !pathBelongsToTenant(path, gate.actor.tenantId)) return json("invalid_image", 400);
  const { error } = await supabaseAdmin.storage
    .from(MARKETING_PUBLISH_BUCKET)
    .upload(path, prepared.jpeg, { contentType: "image/jpeg", upsert: false });
  if (error) {
    console.error("meta_publish_upload_failed");
    return json("upload_failed", 500);
  }
  return NextResponse.json({ mediaObjectPath: path });
}

async function prepareFromBody(
  request: Request,
  action: "mock" | "live",
) {
  const gate = await authorize(request, action);
  if ("response" in gate) return gate;
  const body = await readBody(request);
  if (!body) return { response: json("invalid", 400) };
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!KEY_RE.test(idempotencyKey)) return { response: json("invalid", 400) };
  const captionResult = validateCaption(typeof body.caption === "string" ? body.caption : "");
  if (!captionResult.ok) return { response: json(captionResult.reason, 400) };
  const ids = destinationIds(body.destinationIds);
  const mediaObjectPath = typeof body.mediaObjectPath === "string" ? body.mediaObjectPath : "";
  if (!ids || !pathBelongsToTenant(mediaObjectPath, gate.actor.tenantId)) {
    return { response: json("invalid", 400) };
  }
  return { gate, idempotencyKey, caption: captionResult.caption, ids, mediaObjectPath };
}

export async function publishMock(request: Request) {
  const prepared = await prepareFromBody(request, "mock");
  if ("response" in prepared && prepared.response) return prepared.response;
  if (!("gate" in prepared)) return json("invalid", 400);
  const result = await preparePublishJobs({
    tenantId: prepared.gate.actor.tenantId,
    createdBy: prepared.gate.actor.userId,
    idempotencyKey: prepared.idempotencyKey,
    caption: prepared.caption,
    mediaObjectPath: prepared.mediaObjectPath,
    destinationIds: prepared.ids,
    executionMode: "mock",
  });
  if (result.outcome === "failed") return json("save_failed", 500);
  if (result.outcome !== "created" && result.outcome !== "replay") {
    return json(result.outcome, result.outcome === "destination_mismatch" ? 404 : 409);
  }
  return NextResponse.json({
    ok: true,
    mock: true,
    live: false,
    externalCall: false,
    jobs: result.jobs.map((job) => publicJobResponse(job, false)),
  });
}

async function signMarketingImage(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(MARKETING_PUBLISH_BUCKET)
    .createSignedUrl(path, 1800);
  if (error || !data?.signedUrl || !isMetaFetchableImageUrl(data.signedUrl)) return null;
  return data.signedUrl;
}

export async function publishLive(request: Request) {
  const prepared = await prepareFromBody(request, "live");
  if ("response" in prepared && prepared.response) return prepared.response;
  if (!("gate" in prepared)) return json("invalid", 400);
  if (!prepared.gate.flags.liveCapabilityEnabled || !prepared.gate.flags.envLiveEnabled) {
    return json("live_off", 403);
  }
  const configResult = assertMetaConfig(process.env, { production: false });
  if (!configResult.ok) return json("unconfigured", 403);
  const connection = await readConnection(prepared.gate.actor.tenantId);
  if (!connection) return json("needs_reconnect", 409);
  const expiry = assessStoredTokenExpiry(connection.expiresAt);
  if (connection.status !== "connected" || !expiry.ok) return json("needs_reconnect", 409);

  const result = await preparePublishJobs({
    tenantId: prepared.gate.actor.tenantId,
    createdBy: prepared.gate.actor.userId,
    idempotencyKey: prepared.idempotencyKey,
    caption: prepared.caption,
    mediaObjectPath: prepared.mediaObjectPath,
    destinationIds: prepared.ids,
    executionMode: "live",
  });
  if (result.outcome === "failed") return json("save_failed", 500);
  if (result.outcome !== "created" && result.outcome !== "replay") {
    return json(result.outcome, result.outcome === "destination_mismatch" ? 404 : 409);
  }
  const needsGraph = result.jobs.some(
    (job) => job.executionMode === "live" && job.status === "pending",
  );
  if (!needsGraph) {
    return NextResponse.json({
      ok: true,
      mock: false,
      live: true,
      externalCall: false,
      jobs: result.jobs.map((job) => publicJobResponse(job, false)),
    });
  }
  const secret = await readMetaAccessToken(prepared.gate.actor.tenantId);
  if (!secret.ok) return json("needs_reconnect", 409);

  let calls = 0;
  const http = createMetaPublishHttp();
  const advanced = await advancePublishJobs({
    jobs: result.jobs.map((job) => ({
      id: job.id,
      destinationType: job.destinationType,
      providerDestinationId: job.providerDestinationId,
      status: job.status,
      executionMode: job.executionMode,
      attempts: job.attempts,
      providerPostId: job.providerPostId,
      providerContainerId: job.providerContainerId,
      safeError: job.safeError,
    })),
    mode: "start",
    liveAllowed: true,
    userToken: secret.accessToken,
    scopes: connection.scopes,
    appSecret: configResult.config.appSecret,
    caption: prepared.caption,
    tokenExpiresAt: connection.expiresAt,
    budget: createGraphBudget(),
    http: async (call) => {
      calls += 1;
      return http(call);
    },
    claim: (jobId) => claimPublishJob(prepared.gate.actor.tenantId, jobId),
    settle: (jobId, patch) => settlePublishJob(prepared.gate.actor.tenantId, jobId, patch),
    signImage: () => signMarketingImage(prepared.mediaObjectPath),
  });
  const jobs = result.jobs.map((job) => {
    const state = advanced.find((item) => item.id === job.id);
    return publicJobResponse(state ? mergeJob(job, state) : job, calls > 0);
  });
  return NextResponse.json({ ok: true, mock: false, live: true, externalCall: calls > 0, jobs });
}

export async function verifyPublish(request: Request) {
  const gate = await authorize(request, "verify");
  if ("response" in gate) return gate.response;
  if (!gate.flags.liveCapabilityEnabled || !gate.flags.envLiveEnabled) return json("live_off", 403);
  const body = await readBody(request);
  const jobId = typeof body?.jobId === "string" ? body.jobId.toLowerCase() : "";
  if (!UUID_RE.test(jobId)) return json("invalid", 400);
  const configResult = assertMetaConfig(process.env, { production: false });
  if (!configResult.ok) return json("unconfigured", 403);
  const job = await readPublishJob(gate.actor.tenantId, jobId);
  if (!job) return json("not_found", 404);
  const connection = await readConnection(gate.actor.tenantId);
  if (!connection) return json("needs_reconnect", 409);
  const secret = await readMetaAccessToken(gate.actor.tenantId);
  if (!secret.ok) return json("needs_reconnect", 409);
  let calls = 0;
  const http = createMetaPublishHttp();
  const advanced = await advancePublishJobs({
    jobs: [{
      id: job.id,
      destinationType: job.destinationType,
      providerDestinationId: job.providerDestinationId,
      status: job.status,
      executionMode: job.executionMode,
      attempts: job.attempts,
      providerPostId: job.providerPostId,
      providerContainerId: job.providerContainerId,
      safeError: job.safeError,
    }],
    mode: "verify",
    liveAllowed: true,
    userToken: secret.accessToken,
    scopes: connection.scopes,
    appSecret: configResult.config.appSecret,
    caption: job.caption ?? "",
    tokenExpiresAt: connection.expiresAt,
    budget: createGraphBudget(),
    http: async (call) => {
      calls += 1;
      return http(call);
    },
    claim: (id) => claimPublishJob(gate.actor.tenantId, id),
    settle: (id, patch) => settlePublishJob(gate.actor.tenantId, id, patch),
    signImage: async () => null,
  });
  const state = advanced[0];
  return NextResponse.json({
    ok: true,
    live: true,
    externalCall: calls > 0,
    jobs: [publicJobResponse(state ? mergeJob(job, state) : job, calls > 0)],
  });
}

export async function cleanupPublishMedia(request: Request) {
  const gate = await authorize(request, "cleanup");
  if ("response" in gate) return gate.response;
  const body = await readBody(request);
  const assetId = typeof body?.assetId === "string" ? body.assetId.toLowerCase() : "";
  if (!UUID_RE.test(assetId)) return json("invalid", 400);
  const candidate = await readPublishMediaCandidate(gate.actor.tenantId, assetId);
  if (!candidate.eligible || !pathBelongsToTenant(candidate.path, gate.actor.tenantId)) {
    return json("not_eligible", 409);
  }
  const { error } = await supabaseAdmin.storage
    .from(MARKETING_PUBLISH_BUCKET)
    .remove([candidate.path]);
  if (error) {
    console.error("meta_publish_cleanup_failed");
    return json("cleanup_failed", 500);
  }
  const cleared = await clearPublishMedia(gate.actor.tenantId, assetId);
  if (!cleared) return json("cleanup_failed", 500);
  return NextResponse.json({ ok: true, externalCall: false });
}

export async function releaseAmbiguousPublish(request: Request) {
  const gate = await authorize(request, "release");
  if ("response" in gate) return gate.response;
  const body = await readBody(request);
  const jobId = typeof body?.jobId === "string" ? body.jobId.toLowerCase() : "";
  if (!UUID_RE.test(jobId)) return json("invalid", 400);
  const released = await releaseAmbiguousPublishJob(gate.actor.tenantId, jobId);
  if (released.outcome === "not_found") return json("not_found", 404);
  if (released.outcome === "rejected" || !released.job) return json("release_rejected", 409);
  return NextResponse.json({
    ok: true,
    externalCall: false,
    priorContainer: released.priorContainer,
    warning: released.priorContainer
      ? "Istoricul ambiguu a fost păstrat. Jobul are un container salvat, iar o încercare nouă poate crea o postare în plus."
      : "Istoricul ambiguu a fost păstrat. Nu există un container salvat, dar Meta poate avea unul creat anterior. O încercare nouă poate crea o postare în plus.",
    jobs: [publicJobResponse(released.job, false)],
  });
}

async function readConnection(tenantId: string): Promise<
  | { status: string; scopes: string[]; expiresAt: string | null }
  | null
> {
  const { data, error } = await supabaseAdmin
    .from("marketing_connections")
    .select("status, scopes, token_expires_at")
    .eq("tenant_id", tenantId)
    .eq("provider", "meta")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    status: String(data.status ?? ""),
    scopes: Array.isArray(data.scopes) ? data.scopes.filter((scope) => typeof scope === "string") : [],
    expiresAt: typeof data.token_expires_at === "string" ? data.token_expires_at : null,
  };
}

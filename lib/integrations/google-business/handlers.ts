import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { hostnameFromRequest, isProduction } from "@/lib/app/environment";
import { createOAuthState, hashOAuthState } from "@/lib/integrations/oauth/state";
import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import { bookingLinkForRealPublish } from "@/lib/marketing-ai/publishCardCopy";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createGoogleHttp,
  exchangeGoogleCode,
  listGoogleAccounts,
  listGoogleLocations,
  refreshGoogleBusinessToken,
} from "@/lib/integrations/google-business/api";
import {
  assertGoogleBusinessConfig,
  googleBusinessLiveEnvEnabled,
  googlePublishHostAllowed,
  googlePublishOriginAllowed,
  googleStorageHost,
  isGooglePostId,
  type GoogleBusinessConfig,
} from "@/lib/integrations/google-business/config";
import {
  buildGoogleAuthorizeUrl,
  decideGoogleConnect,
  decideGoogleLivePublish,
  googleAccessTokenNeedsRefresh,
  googleAccountsFailureNotice,
  planGoogleDestinationSave,
  presentGoogleLiveJob,
  presentGooglePublishJob,
  googleSettingsUrl,
  type GoogleAccountsFailureReason,
  type GoogleLiveJobView,
  type GoogleNotice,
} from "@/lib/integrations/google-business/flow";
import {
  GOOGLE_IMAGE_MAX_BYTES,
  GOOGLE_IMAGE_SIGN_SECONDS,
  prepareGooglePostImage,
  resolveGooglePostImage,
} from "@/lib/integrations/google-business/image";
import { buildGoogleImagePost, publishLocalPost, readGoogleLocalPost } from "@/lib/integrations/google-business/publish";
import { marketingImagePath, pathBelongsToTenant } from "@/lib/integrations/meta/publish/image";
import { MARKETING_PUBLISH_BUCKET } from "@/lib/integrations/meta/publish/flags";
import {
  consumeGoogleOAuthState,
  decryptGoogleSecret,
  deleteGoogleConnection,
  encryptGoogleSecret,
  insertGoogleOAuthState,
  readGoogleAccessToken,
  replaceGoogleDestinations,
  saveGoogleAccessToken,
  upsertGoogleConnection,
} from "@/lib/integrations/google-business/store";

function googleRedirect(request: Request, notice: GoogleNotice): NextResponse {
  const key = notice === "select" || notice === "saved" ? "google" : "google_error";
  return NextResponse.redirect(googleSettingsUrl(hostnameFromRequest(request), { [key]: notice }), 303);
}

function googleLoginUrl(request: Request): string {
  const host = hostnameFromRequest(request);
  if (host === "staging.frizeo.ro" || host === "www.frizeo.ro" || host === "frizeo.ro") {
    return `https://${host}/login`;
  }
  return "https://staging.frizeo.ro/login";
}

function googleClosed(request: Request): NextResponse | null {
  if (!googlePublishHostAllowed(hostnameFromRequest(request), isProduction())) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }
  return null;
}

function accountsFailureStatus(reason: GoogleAccountsFailureReason): number {
  if (reason === "rate_limited") return 429;
  if (reason === "network") return 504;
  if (reason === "forbidden" || reason === "api_disabled" || reason === "access_not_approved") return 403;
  return 502;
}

async function googleCapabilityEnabled(
  tenantId: string,
  capability = "marketing.publish.google_business",
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

async function ensureGoogleBusinessAccess(input: {
  tenantId: string;
  config: GoogleBusinessConfig;
}): Promise<
  | { ok: true; accessToken: string; connectionId: string }
  | { ok: false; reason: "needs_reconnect" | "token_refresh_failed" }
> {
  const secret = await readGoogleAccessToken(input.tenantId);
  if (!secret.ok) return { ok: false, reason: "needs_reconnect" };
  if (!googleAccessTokenNeedsRefresh(secret.expiresAt)) {
    return { ok: true, accessToken: secret.accessToken, connectionId: secret.connectionId };
  }
  const refreshed = await refreshGoogleBusinessToken({
    http: createGoogleHttp(),
    config: input.config,
    refreshToken: secret.refreshToken,
  });
  if (!refreshed.ok) return { ok: false, reason: "token_refresh_failed" };
  const saved = await saveGoogleAccessToken({
    tenantId: input.tenantId,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    scopes: refreshed.scopes,
  });
  if (!saved) return { ok: false, reason: "token_refresh_failed" };
  return { ok: true, accessToken: refreshed.accessToken, connectionId: secret.connectionId };
}

async function loadContext() {
  const session = await getAdminSession();
  const production = isProduction();
  const configResult = assertGoogleBusinessConfig(process.env, { production });
  const capabilityEnabled = session?.tenantId
    ? await googleCapabilityEnabled(session.tenantId)
    : false;
  return {
    session,
    production,
    configured: configResult.ok,
    config: configResult.ok ? configResult.config : null,
    capabilityEnabled,
  };
}

export async function startGoogleConnect(request: Request) {
  const closed = googleClosed(request);
  if (closed) return closed;
  const context = await loadContext();
  const limited = await enforceRateLimit(request, {
    bucket: "google-business-connect",
    limit: 10,
    windowSeconds: 600,
    identifier: context.session?.user.id ?? "anonymous",
  });
  if (limited) return limited;
  const gate = decideGoogleConnect({
    authenticated: Boolean(context.session?.user && context.session.tenantId),
    role: context.session?.role ?? null,
    capabilityEnabled: context.capabilityEnabled,
    configured: context.configured,
    production: context.production,
  });
  if (!context.session?.user || !context.session.tenantId || !context.config || !gate.ok) {
    if (!context.session?.user) {
      return NextResponse.redirect(googleLoginUrl(request), 303);
    }
    const notice: GoogleNotice =
      gate.ok ? "unconfigured"
      : gate.reason === "forbidden" ? "forbidden"
      : gate.reason === "capability_off" ? "capability"
      : gate.reason === "production" ? "production"
      : "unconfigured";
    return googleRedirect(request, notice);
  }

  const issued = createOAuthState({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    provider: "google_business",
  });
  if ("error" in issued) return googleRedirect(request, "unconfigured");
  const encrypted = encryptGoogleSecret(issued.pkceVerifier);
  if (!encrypted) return googleRedirect(request, "unconfigured");
  const stored = await insertGoogleOAuthState({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    stateHash: issued.stateHash,
    pkceCiphertext: encrypted.ciphertext,
    pkceNonce: encrypted.nonce,
    expiresAt: issued.expiresAt,
  });
  if (!stored) return googleRedirect(request, "invalid");
  return NextResponse.redirect(buildGoogleAuthorizeUrl({
    config: context.config,
    state: issued.state,
    codeChallenge: issued.pkceChallenge,
  }), 303);
}

export async function finishGoogleCallback(request: Request) {
  const closed = googleClosed(request);
  if (closed) return closed;
  const context = await loadContext();
  if (!context.session?.user || !context.session.tenantId || !context.config) {
    return googleRedirect(request, "mismatch");
  }
  const gate = decideGoogleConnect({
    authenticated: true,
    role: context.session.role,
    capabilityEnabled: context.capabilityEnabled,
    configured: context.configured,
    production: context.production,
  });
  if (!gate.ok) {
    const notice: GoogleNotice =
      gate.reason === "capability_off" ? "capability"
      : gate.reason === "production" ? "production"
      : gate.reason === "forbidden" ? "forbidden"
      : gate.reason === "unconfigured" ? "unconfigured"
      : "mismatch";
    return googleRedirect(request, notice);
  }

  const url = new URL(request.url);
  if (url.searchParams.get("error")) return googleRedirect(request, "denied");
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const stateHash = hashOAuthState(state);
  if (!code || !stateHash) return googleRedirect(request, "invalid");
  const consumed = await consumeGoogleOAuthState(stateHash);
  if (consumed.outcome !== "ok") {
    const notice: GoogleNotice =
      consumed.outcome === "expired" || consumed.outcome === "consumed"
        ? consumed.outcome
        : consumed.outcome === "provider_mismatch"
          ? "mismatch"
          : "invalid";
    return googleRedirect(request, notice);
  }
  if (consumed.tenantId !== context.session.tenantId || consumed.userId !== context.session.user.id) {
    return googleRedirect(request, "mismatch");
  }
  const verifier = decryptGoogleSecret(consumed.pkceCiphertext, consumed.pkceNonce);
  if (!verifier) return googleRedirect(request, "invalid");

  const token = await exchangeGoogleCode({
    http: createGoogleHttp(),
    config: context.config,
    code,
    codeVerifier: verifier,
  });
  if (!token.ok) {
    if (token.reason === "calendar_scope") return googleRedirect(request, "calendar_scope");
    if (token.reason === "missing_scope") return googleRedirect(request, "permissions");
    if (token.reason === "unexpected_scope") return googleRedirect(request, "unexpected_scope");
    if (token.reason === "missing_expiry") return googleRedirect(request, "unknown_expiry");
    return googleRedirect(request, "exchange_failed");
  }

  const listed = await listGoogleAccounts({ http: createGoogleHttp(), accessToken: token.accessToken });
  if (!listed.ok) return googleRedirect(request, googleAccountsFailureNotice(listed.reason));
  const account = listed.accounts[0];
  if (!account) return googleRedirect(request, "no_locations");
  const saved = await upsertGoogleConnection({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    providerAccountId: account.name,
    displayName: account.accountName,
    status: "setup_required",
    scopes: token.scopes,
    tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000).toISOString(),
    lastError: null,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
  });
  if (!saved) return googleRedirect(request, "invalid");
  return googleRedirect(request, "select");
}

export async function listGoogleBusinessLocations(request: Request) {
  const closed = googleClosed(request);
  if (closed) return closed;
  const context = await loadContext();
  if (!context.session?.user || !context.session.tenantId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const gate = decideGoogleConnect({
    authenticated: true,
    role: context.session.role,
    capabilityEnabled: context.capabilityEnabled,
    configured: true,
    production: context.production,
  });
  if (!gate.ok) {
    const error = gate.reason === "capability_off" ? "capability_off" : gate.reason;
    return NextResponse.json({ error }, { status: gate.reason === "forbidden" ? 403 : 403 });
  }
  if (!context.config) return NextResponse.json({ error: "unconfigured" }, { status: 403 });
  const access = await ensureGoogleBusinessAccess({
    tenantId: context.session.tenantId,
    config: context.config,
  });
  if (!access.ok) return NextResponse.json({ error: "needs_reconnect" }, { status: 409 });
  const listed = await listGoogleAccounts({ http: createGoogleHttp(), accessToken: access.accessToken });
  if (!listed.ok) {
    return NextResponse.json(
      { error: googleAccountsFailureNotice(listed.reason) },
      { status: accountsFailureStatus(listed.reason) },
    );
  }
  const locations = [];
  for (const account of listed.accounts) {
    try {
      locations.push(...await listGoogleLocations({
        http: createGoogleHttp(),
        accessToken: access.accessToken,
        accountName: account.name,
      }));
    } catch {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
  }
  return NextResponse.json({
    locations: locations.map((location) => ({
      id: location.id,
      title: location.title,
      accountName: location.accountName,
    })),
  });
}

export async function selectGoogleDestinations(request: Request) {
  const closed = googleClosed(request);
  if (closed) return closed;
  const context = await loadContext();
  if (!context.session?.user || !context.session.tenantId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!canAdministerIntegrations(context.session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!context.capabilityEnabled) {
    return NextResponse.json({ error: "capability_off" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { destinationIds?: unknown } | null;
  const selectedIds = Array.isArray(body?.destinationIds)
    ? body.destinationIds.filter((id): id is string => typeof id === "string")
    : [];
  if (!context.config) return NextResponse.json({ error: "unconfigured" }, { status: 403 });
  const access = await ensureGoogleBusinessAccess({
    tenantId: context.session.tenantId,
    config: context.config,
  });
  if (!access.ok) return NextResponse.json({ error: "needs_reconnect" }, { status: 409 });
  const listed = await listGoogleAccounts({ http: createGoogleHttp(), accessToken: access.accessToken });
  if (!listed.ok) {
    return NextResponse.json(
      { error: googleAccountsFailureNotice(listed.reason) },
      { status: accountsFailureStatus(listed.reason) },
    );
  }
  if (listed.accounts.length === 0) {
    return NextResponse.json({ error: "no_locations" }, { status: 409 });
  }
  const discovered = [];
  for (const account of listed.accounts) {
    discovered.push(...await listGoogleLocations({
      http: createGoogleHttp(),
      accessToken: access.accessToken,
      accountName: account.name,
    }));
  }
  const plan = planGoogleDestinationSave({
    tenantId: context.session.tenantId,
    discovered,
    selectedIds,
  });
  if (!plan.ok) return NextResponse.json({ error: plan.reason }, { status: 400 });
  const saved = await replaceGoogleDestinations({
    tenantId: context.session.tenantId,
    connectionId: access.connectionId,
    destinations: plan.rows,
  });
  if (!saved) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return googleRedirect(request, "saved");
}

export async function disconnectGoogle(request: Request) {
  const closed = googleClosed(request);
  if (closed) return closed;
  const session = await getAdminSession();
  if (!session?.user || !session.tenantId) {
    return NextResponse.redirect(googleLoginUrl(request), 303);
  }
  if (!canAdministerIntegrations(session.role)) return googleRedirect(request, "forbidden");
  const removed = await deleteGoogleConnection(session.tenantId);
  return googleRedirect(request, removed ? "disconnected" : "invalid");
}

export async function publishGoogleMock(request: Request) {
  if (!googlePublishHostAllowed(hostnameFromRequest(request), isProduction())) {
    return NextResponse.json({ error: "not_configured", externalCall: false }, { status: 404 });
  }
  if (!googlePublishOriginAllowed(request, isProduction())) {
    return NextResponse.json({ error: "origin", externalCall: false }, { status: 403 });
  }
  const session = await getAdminSession();
  if (!session?.user || !session.tenantId) {
    return NextResponse.json({ error: "unauthenticated", externalCall: false }, { status: 401 });
  }
  if (!canAdministerIntegrations(session.role)) {
    return NextResponse.json({ error: "forbidden", externalCall: false }, { status: 403 });
  }
  if (!(await googleCapabilityEnabled(session.tenantId))) {
    return NextResponse.json({ error: "capability_off", externalCall: false }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as {
    idempotencyKey?: unknown;
    caption?: unknown;
    mediaObjectPath?: unknown;
    bookingUrl?: unknown;
    destinationIds?: unknown;
  } | null;
  const destinationIds = Array.isArray(body?.destinationIds)
    ? body.destinationIds.filter((id): id is string => typeof id === "string")
    : [];
  const { data, error } = await supabaseAdmin.rpc("google_business_publish_prepare", {
    p_tenant_id: session.tenantId,
    p_created_by: session.user.id,
    p_idempotency_key: typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "",
    p_caption: typeof body?.caption === "string" ? body.caption : "",
    p_media_object_path: typeof body?.mediaObjectPath === "string" ? body.mediaObjectPath : "",
    p_booking_url: typeof body?.bookingUrl === "string" ? body.bookingUrl : "",
    p_destination_ids: destinationIds,
  });
  const row = data && typeof data === "object" ? data as { outcome?: unknown; jobs?: unknown } : null;
  if (error || !row) {
    return NextResponse.json({ error: "save_failed", externalCall: false }, { status: 500 });
  }
  const outcome = typeof row.outcome === "string" ? row.outcome : "invalid";
  if (outcome !== "created" && outcome !== "replay") {
    const status = outcome === "destination_mismatch" ? 403 : 400;
    return NextResponse.json({ error: outcome, externalCall: false }, { status });
  }
  const jobs = Array.isArray(row.jobs)
    ? row.jobs.flatMap((job) => {
      const view = presentGooglePublishJob(job);
      return view ? [view] : [];
    })
    : [];
  if (jobs.length !== destinationIds.length) {
    return NextResponse.json({ error: "invalid", externalCall: false }, { status: 400 });
  }
  return NextResponse.json({ jobs, externalCall: false });
}

async function signGooglePostImage(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(MARKETING_PUBLISH_BUCKET)
    .createSignedUrl(path, GOOGLE_IMAGE_SIGN_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function probeGooglePostImage(url: string): Promise<{
  status: number;
  contentType: string | null;
  bytes: Buffer;
} | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const contentType = response.headers.get("content-type");
    if (response.status !== 200) return { status: response.status, contentType, bytes: Buffer.alloc(0) };
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > GOOGLE_IMAGE_MAX_BYTES) {
      return { status: 200, contentType, bytes: Buffer.alloc(0) };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: 200, contentType, bytes: bytes.subarray(0, GOOGLE_IMAGE_MAX_BYTES + 1) };
  } catch {
    return null;
  }
}

export async function uploadGooglePostImage(request: Request) {
  if (!googlePublishHostAllowed(hostnameFromRequest(request), isProduction())) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }
  if (!googlePublishOriginAllowed(request, isProduction())) {
    return NextResponse.json({ error: "origin" }, { status: 403 });
  }
  const session = await getAdminSession();
  if (!session?.user || !session.tenantId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!canAdministerIntegrations(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!(await googleCapabilityEnabled(session.tenantId))) {
    return NextResponse.json({ error: "capability_off" }, { status: 403 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  const file = form.get("image");
  if (!(file instanceof File) || file.size <= 0 || file.size > 8_388_608) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  const prepared = await prepareGooglePostImage(Buffer.from(await file.arrayBuffer()));
  if (!prepared.ok) return NextResponse.json({ error: prepared.reason }, { status: 400 });
  const path = marketingImagePath(session.tenantId, crypto.randomUUID());
  if (!path || !pathBelongsToTenant(path, session.tenantId)) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.storage
    .from(MARKETING_PUBLISH_BUCKET)
    .upload(path, prepared.jpeg, { contentType: "image/jpeg", upsert: false });
  if (error) {
    console.error("google_business_image_upload_failed");
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
  return NextResponse.json({ mediaObjectPath: path, externalCall: false });
}

function liveStatus(reason: string): number {
  if (reason === "unauthenticated") return 401;
  if (reason === "production") return 404;
  if (
    reason === "destination_mismatch"
    || reason === "location_ineligible"
    || reason === "forbidden"
    || reason === "capability_off"
    || reason === "live_off"
    || reason === "unconfigured"
    || reason === "origin"
  ) return 403;
  return 400;
}

async function settleGoogleLive(input: {
  tenantId: string;
  jobId: string;
  status: "published" | "failed" | "unknown";
  providerPostId?: string | null;
  safeError?: string | null;
}): Promise<GoogleLiveJobView | null> {
  const { data, error } = await supabaseAdmin.rpc("google_business_live_settle", {
    p_tenant_id: input.tenantId,
    p_job_id: input.jobId,
    p_status: input.status,
    p_provider_post_id: input.providerPostId ?? "",
    p_safe_error: input.safeError ?? "",
  });
  const row = data && typeof data === "object" ? data as { job?: unknown } : null;
  if (error || !row) return null;
  return presentGoogleLiveJob(row.job);
}

export async function publishGoogleLive(request: Request) {
  if (!googlePublishHostAllowed(hostnameFromRequest(request), isProduction())) {
    return NextResponse.json({ error: "not_configured", externalCall: false }, { status: 404 });
  }
  if (!googlePublishOriginAllowed(request, isProduction())) {
    return NextResponse.json({ error: "origin", externalCall: false }, { status: 403 });
  }
  const session = await getAdminSession();
  if (!session?.user || !session.tenantId) {
    return NextResponse.json({ error: "unauthenticated", externalCall: false }, { status: 401 });
  }
  const production = isProduction();
  const configResult = assertGoogleBusinessConfig(process.env, { production });
  const [integrationEnabled, liveCapabilityEnabled] = await Promise.all([
    googleCapabilityEnabled(session.tenantId),
    googleCapabilityEnabled(session.tenantId, "marketing.publish.google_business.live"),
  ]);
  const decision = decideGoogleLivePublish({
    authenticated: true,
    role: session.role,
    integrationEnabled,
    liveCapabilityEnabled,
    envLiveEnabled: googleBusinessLiveEnvEnabled(),
    configured: configResult.ok,
    production,
  });
  if (!decision.ok || !configResult.ok) {
    const reason = decision.ok ? "unconfigured" : decision.reason === "production" ? "not_configured" : decision.reason;
    const status = decision.ok ? 403 : decision.reason === "unauthenticated" ? 401 : decision.reason === "production" ? 404 : 403;
    return NextResponse.json({ error: reason, externalCall: false }, { status });
  }

  const body = await request.json().catch(() => null) as {
    idempotencyKey?: unknown;
    caption?: unknown;
    mediaObjectPath?: unknown;
    bookingUrl?: unknown;
    destinationIds?: unknown;
  } | null;
  const mediaObjectPath = typeof body?.mediaObjectPath === "string" ? body.mediaObjectPath.trim() : "";
  const rawBooking = typeof body?.bookingUrl === "string" ? body.bookingUrl.trim() : "";
  const bookingUrl = bookingLinkForRealPublish(rawBooking) ?? "";
  if (!mediaObjectPath) {
    return NextResponse.json({ error: "image_required", externalCall: false }, { status: 400 });
  }
  if (!pathBelongsToTenant(mediaObjectPath, session.tenantId)) {
    return NextResponse.json({ error: "invalid_image", externalCall: false }, { status: 400 });
  }
  if (rawBooking && !bookingUrl) {
    return NextResponse.json({ error: "booking_link", externalCall: false }, { status: 400 });
  }
  const destinationIds = Array.isArray(body?.destinationIds)
    ? body.destinationIds.filter((id): id is string => typeof id === "string")
    : [];
  const { data, error } = await supabaseAdmin.rpc("google_business_publish_live_prepare", {
    p_tenant_id: session.tenantId,
    p_created_by: session.user.id,
    p_idempotency_key: typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "",
    p_caption: typeof body?.caption === "string" ? body.caption : "",
    p_media_object_path: mediaObjectPath,
    p_booking_url: bookingUrl,
    p_destination_ids: destinationIds,
  });
  const row = data && typeof data === "object" ? data as { outcome?: unknown; jobs?: unknown } : null;
  if (error || !row) {
    return NextResponse.json({ error: "save_failed", externalCall: false }, { status: 500 });
  }
  const outcome = typeof row.outcome === "string" ? row.outcome : "invalid";
  const prepared = Array.isArray(row.jobs) ? row.jobs.flatMap((job) => {
    const view = presentGoogleLiveJob(job);
    return view ? [view] : [];
  }) : [];
  if (outcome !== "created" && outcome !== "replay") {
    return NextResponse.json({ error: outcome, externalCall: false }, { status: liveStatus(outcome) });
  }
  const job = prepared[0];
  if (!job || prepared.length !== 1) {
    return NextResponse.json({ error: "invalid", externalCall: false }, { status: 400 });
  }
  if (outcome === "replay" && (job.status !== "pending" || job.attempts !== 0)) {
    return NextResponse.json({ jobs: [job], externalCall: false });
  }
  if (!job.mediaObjectPath) {
    const settled = await settleGoogleLive({
      tenantId: session.tenantId,
      jobId: job.id,
      status: "failed",
      safeError: "image_required",
    });
    return NextResponse.json({
      error: "image_required",
      jobs: settled ? [settled] : [job],
      externalCall: false,
    }, { status: 400 });
  }
  if (job.bookingUrl && !bookingLinkForRealPublish(job.bookingUrl)) {
    const settled = await settleGoogleLive({
      tenantId: session.tenantId,
      jobId: job.id,
      status: "failed",
      safeError: "booking_link",
    });
    return NextResponse.json({
      error: "booking_link",
      jobs: settled ? [settled] : [job],
      externalCall: false,
    }, { status: 400 });
  }
  const storageHost = googleStorageHost();
  const image = await resolveGooglePostImage({
    tenantId: session.tenantId,
    mediaObjectPath: job.mediaObjectPath,
    storageHost,
    sign: signGooglePostImage,
    probe: probeGooglePostImage,
  });
  if (!image.ok) {
    const settled = await settleGoogleLive({
      tenantId: session.tenantId,
      jobId: job.id,
      status: "failed",
      safeError: "invalid_image",
    });
    return NextResponse.json({
      error: "invalid_image",
      jobs: settled ? [settled] : [job],
      externalCall: false,
    }, { status: 400 });
  }
  const post = buildGoogleImagePost({
    summary: job.caption,
    imageUrl: image.sourceUrl,
    tenantId: session.tenantId,
    storageHost,
    bookingUrl: job.bookingUrl,
  });
  if (!post.ok) {
    const settled = await settleGoogleLive({
      tenantId: session.tenantId,
      jobId: job.id,
      status: "failed",
      safeError: post.reason === "image" ? "invalid_image" : post.reason,
    });
    return NextResponse.json({
      error: post.reason === "image" ? "invalid_image" : post.reason,
      jobs: settled ? [settled] : [job],
      externalCall: false,
    }, { status: 400 });
  }

  const access = await ensureGoogleBusinessAccess({
    tenantId: session.tenantId,
    config: configResult.config,
  });
  if (!access.ok) {
    const settled = await settleGoogleLive({
      tenantId: session.tenantId,
      jobId: job.id,
      status: "failed",
      safeError: access.reason === "needs_reconnect" ? "token_unavailable" : "token_refresh_failed",
    });
    return NextResponse.json({
      error: access.reason === "needs_reconnect" ? "token_unavailable" : "token_refresh_failed",
      jobs: settled ? [settled] : [job],
      externalCall: false,
    }, { status: 409 });
  }

  const { data: claimData, error: claimError } = await supabaseAdmin.rpc("google_business_live_claim", {
    p_tenant_id: session.tenantId,
    p_job_id: job.id,
  });
  const claim = claimData && typeof claimData === "object"
    ? claimData as { outcome?: unknown; job?: unknown }
    : null;
  const claimed = presentGoogleLiveJob(claim?.job);
  if (claimError || claim?.outcome !== "claimed" || !claimed) {
    return NextResponse.json({
      jobs: claimed ? [claimed] : [job],
      externalCall: false,
    });
  }

  const published = await publishLocalPost({
    http: createGoogleHttp(),
    accessToken: access.accessToken,
    locationId: claimed.providerDestinationId,
    post: post.body,
  });
  console.error(JSON.stringify({
    source: "google_business_local_post",
    httpStatus: published.ok ? 200 : published.reason === "invalid_location" ? null : published.httpStatus,
    outcome: published.ok ? "published" : published.reason,
    safeError: published.ok ? null : published.reason === "invalid_location" ? "invalid_location" : published.safeError,
  }));
  if (!published.ok && published.reason === "invalid_location") {
    const settled = await settleGoogleLive({
      tenantId: session.tenantId,
      jobId: claimed.id,
      status: "failed",
      safeError: "location_ineligible",
    });
    return NextResponse.json({
      error: "location_ineligible",
      jobs: settled ? [settled] : [claimed],
      externalCall: false,
    }, { status: 403 });
  }
  const settled = await settleGoogleLive({
    tenantId: session.tenantId,
    jobId: claimed.id,
    status: published.ok ? "published" : published.reason === "rejected" ? "failed" : "unknown",
    providerPostId: published.ok ? published.providerPostId : null,
    safeError: published.ok ? null : published.safeError,
  });
  if (!settled) {
    return NextResponse.json({ error: "ambiguous", jobs: [claimed], externalCall: true }, { status: 502 });
  }
  return NextResponse.json({ jobs: [settled], externalCall: true });
}

export async function readPublishedGooglePost(request: Request) {
  if (!googlePublishHostAllowed(hostnameFromRequest(request), isProduction())) {
    return NextResponse.json({ error: "not_configured", externalCall: false }, { status: 404 });
  }
  const session = await getAdminSession();
  if (!session?.user || !session.tenantId) {
    return NextResponse.json({ error: "unauthenticated", externalCall: false }, { status: 401 });
  }
  if (!canAdministerIntegrations(session.role)) {
    return NextResponse.json({ error: "forbidden", externalCall: false }, { status: 403 });
  }
  const configResult = assertGoogleBusinessConfig(process.env, { production: isProduction() });
  if (!configResult.ok) {
    return NextResponse.json({ error: "unconfigured", externalCall: false }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("integration_publish_jobs")
    .select("attempts, provider_post_id, integration_assets!inner(body)")
    .eq("tenant_id", session.tenantId)
    .eq("provider", "google_business")
    .eq("execution_mode", "live")
    .eq("status", "published");
  const rows = Array.isArray(data) ? data : [];
  const row = rows[0];
  const asset = row && (Array.isArray(row.integration_assets) ? row.integration_assets[0] : row.integration_assets);
  const caption = asset && typeof asset.body === "string" ? asset.body : "";
  const providerPostId = row && typeof row.provider_post_id === "string" ? row.provider_post_id : "";
  if (error || rows.length !== 1 || !caption || !isGooglePostId(providerPostId)) {
    return NextResponse.json({ error: "not_found", externalCall: false }, { status: 404 });
  }
  const access = await ensureGoogleBusinessAccess({
    tenantId: session.tenantId,
    config: configResult.config,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.reason, externalCall: false }, { status: 403 });
  }
  const read = await readGoogleLocalPost({
    http: createGoogleHttp(),
    accessToken: access.accessToken,
    providerPostId,
  });
  if (!read.ok) {
    return NextResponse.json({
      error: read.reason,
      summaryMatches: false,
      hasPhoto: false,
      callToAction: false,
      externalCall: true,
    }, { status: read.reason === "rejected" ? 400 : 502 });
  }
  const summaryMatches = read.summary === caption;
  return NextResponse.json({
    verified: summaryMatches && read.hasPhoto,
    summaryMatches,
    hasPhoto: read.hasPhoto,
    callToAction: read.callToAction,
    state: read.state,
    attempts: row.attempts,
    externalCall: true,
  });
}

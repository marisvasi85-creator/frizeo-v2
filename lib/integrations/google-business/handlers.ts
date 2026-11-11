import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { isProduction } from "@/lib/app/environment";
import { createOAuthState, hashOAuthState } from "@/lib/integrations/oauth/state";
import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import {
  publishHostAllowed,
  publishOriginAllowed,
} from "@/lib/integrations/meta/publish/flags";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createGoogleHttp,
  exchangeGoogleCode,
  listGoogleAccounts,
  listGoogleLocations,
} from "@/lib/integrations/google-business/api";
import {
  assertGoogleBusinessConfig,
  GOOGLE_BUSINESS_SCOPE,
} from "@/lib/integrations/google-business/config";
import {
  buildGoogleAuthorizeUrl,
  decideGoogleConnect,
  googleAccountsFailureNotice,
  planGoogleDestinationSave,
  presentGooglePublishJob,
  stagingGoogleSettingsUrl,
  type GoogleAccountsFailureReason,
  type GoogleNotice,
} from "@/lib/integrations/google-business/flow";
import {
  consumeGoogleOAuthState,
  decryptGoogleSecret,
  deleteGoogleConnection,
  encryptGoogleSecret,
  insertGoogleOAuthState,
  readGoogleAccessToken,
  replaceGoogleDestinations,
  upsertGoogleConnection,
} from "@/lib/integrations/google-business/store";

function googleRedirect(notice: GoogleNotice): NextResponse {
  const key = notice === "select" || notice === "saved" ? "google" : "google_error";
  return NextResponse.redirect(stagingGoogleSettingsUrl({ [key]: notice }), 303);
}

function accountsFailureStatus(reason: GoogleAccountsFailureReason): number {
  if (reason === "rate_limited") return 429;
  if (reason === "network") return 504;
  if (reason === "forbidden" || reason === "api_disabled" || reason === "access_not_approved") return 403;
  return 502;
}

async function googleCapabilityEnabled(tenantId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("tenant_capabilities")
    .select("enabled")
    .eq("tenant_id", tenantId)
    .eq("capability", "marketing.publish.google_business")
    .maybeSingle();
  if (error || !data) return false;
  return data.enabled === true;
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
  if (isProduction()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
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
      return NextResponse.redirect("https://staging.frizeo.ro/login", 303);
    }
    const notice: GoogleNotice =
      gate.ok ? "unconfigured"
      : gate.reason === "forbidden" ? "forbidden"
      : gate.reason === "capability_off" ? "capability"
      : gate.reason === "production" ? "production"
      : "unconfigured";
    return googleRedirect(notice);
  }

  const issued = createOAuthState({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    provider: "google_business",
  });
  if ("error" in issued) return googleRedirect("unconfigured");
  const encrypted = encryptGoogleSecret(issued.pkceVerifier);
  if (!encrypted) return googleRedirect("unconfigured");
  const stored = await insertGoogleOAuthState({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    stateHash: issued.stateHash,
    pkceCiphertext: encrypted.ciphertext,
    pkceNonce: encrypted.nonce,
    expiresAt: issued.expiresAt,
  });
  if (!stored) return googleRedirect("invalid");
  return NextResponse.redirect(buildGoogleAuthorizeUrl({
    config: context.config,
    state: issued.state,
    codeChallenge: issued.pkceChallenge,
  }), 303);
}

export async function finishGoogleCallback(request: Request) {
  if (isProduction()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  const context = await loadContext();
  if (!context.session?.user || !context.session.tenantId || !context.config) {
    return googleRedirect("mismatch");
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
    return googleRedirect(notice);
  }

  const url = new URL(request.url);
  if (url.searchParams.get("error")) return googleRedirect("denied");
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const stateHash = hashOAuthState(state);
  if (!code || !stateHash) return googleRedirect("invalid");
  const consumed = await consumeGoogleOAuthState(stateHash);
  if (consumed.outcome !== "ok") {
    const notice: GoogleNotice =
      consumed.outcome === "expired" || consumed.outcome === "consumed"
        ? consumed.outcome
        : consumed.outcome === "provider_mismatch"
          ? "mismatch"
          : "invalid";
    return googleRedirect(notice);
  }
  if (consumed.tenantId !== context.session.tenantId || consumed.userId !== context.session.user.id) {
    return googleRedirect("mismatch");
  }
  const verifier = decryptGoogleSecret(consumed.pkceCiphertext, consumed.pkceNonce);
  if (!verifier) return googleRedirect("invalid");

  const token = await exchangeGoogleCode({
    http: createGoogleHttp(),
    config: context.config,
    code,
    codeVerifier: verifier,
  });
  if (!token.ok) {
    if (token.reason === "calendar_scope") return googleRedirect("calendar_scope");
    if (token.reason === "missing_scope") return googleRedirect("permissions");
    if (token.reason === "missing_expiry") return googleRedirect("unknown_expiry");
    return googleRedirect("exchange_failed");
  }

  const listed = await listGoogleAccounts({ http: createGoogleHttp(), accessToken: token.accessToken });
  if (!listed.ok) return googleRedirect(googleAccountsFailureNotice(listed.reason));
  const account = listed.accounts[0];
  if (!account) return googleRedirect("no_locations");
  const saved = await upsertGoogleConnection({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    providerAccountId: account.name,
    displayName: account.accountName,
    status: "setup_required",
    scopes: [GOOGLE_BUSINESS_SCOPE],
    tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000).toISOString(),
    lastError: null,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
  });
  if (!saved) return googleRedirect("invalid");
  return googleRedirect("select");
}

export async function listGoogleBusinessLocations(_request: Request) {
  if (isProduction()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
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
  const secret = await readGoogleAccessToken(context.session.tenantId);
  if (!secret.ok) return NextResponse.json({ error: "needs_reconnect" }, { status: 409 });
  if (secret.expiresAt && new Date(secret.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: "needs_reconnect" }, { status: 409 });
  }
  const listed = await listGoogleAccounts({ http: createGoogleHttp(), accessToken: secret.accessToken });
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
        accessToken: secret.accessToken,
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
  if (isProduction()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
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
  const secret = await readGoogleAccessToken(context.session.tenantId);
  if (!secret.ok) return NextResponse.json({ error: "needs_reconnect" }, { status: 409 });
  const listed = await listGoogleAccounts({ http: createGoogleHttp(), accessToken: secret.accessToken });
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
      accessToken: secret.accessToken,
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
    connectionId: secret.connectionId,
    destinations: plan.rows,
  });
  if (!saved) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return googleRedirect("saved");
}

export async function disconnectGoogle(_request: Request) {
  if (isProduction()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  const session = await getAdminSession();
  if (!session?.user || !session.tenantId) {
    return NextResponse.redirect("https://staging.frizeo.ro/login", 303);
  }
  if (!canAdministerIntegrations(session.role)) return googleRedirect("forbidden");
  const removed = await deleteGoogleConnection(session.tenantId);
  return googleRedirect(removed ? "disconnected" : "invalid");
}

export async function publishGoogleMock(request: Request) {
  if (isProduction() || !publishHostAllowed(request)) {
    return NextResponse.json({ error: "not_configured", externalCall: false }, { status: 404 });
  }
  if (!publishOriginAllowed(request)) {
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

export async function publishGoogleLive(request: Request) {
  if (isProduction() || !publishHostAllowed(request)) {
    return NextResponse.json({ error: "not_configured", externalCall: false }, { status: 404 });
  }
  const session = await getAdminSession();
  if (!session?.user || !session.tenantId) {
    return NextResponse.json({ error: "unauthenticated", externalCall: false }, { status: 401 });
  }
  if (!canAdministerIntegrations(session.role)) {
    return NextResponse.json({ error: "forbidden", externalCall: false }, { status: 403 });
  }
  return NextResponse.json({ error: "live_off", externalCall: false }, { status: 403 });
}

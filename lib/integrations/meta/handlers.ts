import { NextResponse } from "next/server";
import { createOAuthState, hashOAuthState } from "@/lib/integrations/oauth/state";
import { runMetaCallback } from "@/lib/integrations/meta/callback";
import {
  buildMetaAuthorizeUrl,
  decideMetaConnect,
  isBrowserSafeMetaRedirect,
  planDisconnect,
  planMetaDestinationSave,
} from "@/lib/integrations/meta/flow";
import {
  exchangeMetaAuthorization,
  fetchMetaPages,
  revokeMetaPermissions,
} from "@/lib/integrations/meta/graph";
import {
  loadMetaRequestContext,
  metaProductionBlocked,
  metaRateLimit,
  metaSettingsRedirect,
} from "@/lib/integrations/meta/http";
import {
  consumeMetaOAuthState,
  decryptPkceVerifier,
  deleteMetaConnection,
  encryptPkceVerifier,
  insertMetaOAuthState,
  readMetaAccessToken,
  replaceMetaDestinations,
  upsertMetaConnection,
} from "@/lib/integrations/meta/store";

export async function startMetaConnect(request: Request) {
  const blocked = await metaProductionBlocked();
  if (blocked) return blocked;

  const context = await loadMetaRequestContext();
  const limited = await metaRateLimit(
    request,
    "meta-oauth-connect",
    context.session?.user.id ?? "anonymous",
  );
  if (limited) return limited;

  const gate = decideMetaConnect({
    authenticated: Boolean(context.session?.user && context.session.tenantId),
    role: context.session?.role ?? null,
    capabilityEnabled: context.capabilityEnabled,
    configured: context.configured,
    production: context.production,
  });
  if (!context.session?.user || !context.session.tenantId) {
    return NextResponse.redirect("https://staging.frizeo.ro/login", 303);
  }
  if (!gate.ok) {
    const notice =
      gate.reason === "forbidden"
        ? "forbidden"
        : gate.reason === "capability_off"
          ? "capability"
          : gate.reason === "production"
            ? "production"
            : "unconfigured";
    return metaSettingsRedirect(notice);
  }
  if (!context.config) return metaSettingsRedirect("unconfigured");

  const issued = createOAuthState({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    provider: "meta",
  });
  if ("error" in issued) return metaSettingsRedirect("unconfigured");
  const encrypted = encryptPkceVerifier(issued.pkceVerifier);
  if (!encrypted) return metaSettingsRedirect("unconfigured");

  const stored = await insertMetaOAuthState({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    stateHash: issued.stateHash,
    pkceCiphertext: encrypted.ciphertext,
    pkceNonce: encrypted.nonce,
    expiresAt: issued.expiresAt,
  });
  if (!stored) return metaSettingsRedirect("unconfigured");

  const target = buildMetaAuthorizeUrl({
    config: context.config,
    state: issued.state,
    codeChallenge: issued.pkceChallenge,
  });
  if (!isBrowserSafeMetaRedirect(target) || target.includes(issued.pkceVerifier)) {
    return metaSettingsRedirect("unconfigured");
  }
  return NextResponse.redirect(target, 303);
}

export async function finishCallback(request: Request) {
  const blocked = await metaProductionBlocked();
  if (blocked) return blocked;
  const context = await loadMetaRequestContext();
  const limited = await metaRateLimit(
    request,
    "meta-oauth-callback",
    context.session?.user.id ?? "anonymous",
  );
  if (limited) return limited;

  const url = new URL(request.url);
  const result = await runMetaCallback({
    query: url.searchParams,
    session: context.session?.user && context.session.tenantId
      ? {
          userId: context.session.user.id,
          tenantId: context.session.tenantId,
          role: context.session.role,
        }
      : null,
    capabilityEnabled: context.capabilityEnabled,
    configured: context.configured,
    production: context.production,
    config: context.config,
    consumeState: (state) => consumeMetaOAuthState(hashOAuthState(state)),
    decryptPkce: decryptPkceVerifier,
    exchangeCode: async (code, verifier) => {
      if (!context.config) return { ok: false, reason: "exchange_failed" };
      return exchangeMetaAuthorization({
        config: context.config,
        code,
        codeVerifier: verifier,
      });
    },
    persist: async (row) => {
      if (!context.session?.user || !context.session.tenantId) return false;
      return upsertMetaConnection({
        tenantId: context.session.tenantId,
        userId: context.session.user.id,
        providerAccountId: row.providerAccountId,
        displayName: row.displayName,
        status: row.status,
        scopes: row.scopes,
        expiresAt: row.expiresAt,
        lastError: row.lastError,
        accessToken: row.accessToken,
      });
    },
  });
  if ("http" in result) return NextResponse.redirect("https://staging.frizeo.ro/login", 303);
  return metaSettingsRedirect(result.notice);
}

export async function discoverDestinations(request: Request) {
  const blocked = await metaProductionBlocked();
  if (blocked) return blocked;
  const context = await loadMetaRequestContext();
  const limited = await metaRateLimit(
    request,
    "meta-oauth-discover",
    context.session?.user.id ?? "anonymous",
  );
  if (limited) return limited;
  const gate = decideMetaConnect({
    authenticated: Boolean(context.session?.user && context.session.tenantId),
    role: context.session?.role ?? null,
    capabilityEnabled: context.capabilityEnabled,
    configured: context.configured,
    production: context.production,
  });
  if (!gate.ok || !context.session?.tenantId || !context.config) {
    return NextResponse.json({ error: gate.ok ? "unconfigured" : gate.reason }, { status: 403 });
  }
  const stored = await readMetaAccessToken(context.session.tenantId);
  if (!stored.ok) return NextResponse.json({ error: "missing" }, { status: 409 });
  if (stored.expiresAt && Date.parse(stored.expiresAt) <= Date.now()) {
    return NextResponse.json({ error: "needs_reconnect" }, { status: 409 });
  }
  const discovered = await fetchMetaPages({
    config: context.config,
    accessToken: stored.accessToken,
  });
  if (!discovered.ok) {
    return NextResponse.json({ error: discovered.reason }, { status: 502 });
  }
  return NextResponse.json({ pages: discovered.pages });
}

export async function selectDestinations(request: Request) {
  const blocked = await metaProductionBlocked();
  if (blocked) return blocked;
  const context = await loadMetaRequestContext();
  const limited = await metaRateLimit(
    request,
    "meta-oauth-select",
    context.session?.user.id ?? "anonymous",
  );
  if (limited) return limited;
  const gate = decideMetaConnect({
    authenticated: Boolean(context.session?.user && context.session.tenantId),
    role: context.session?.role ?? null,
    capabilityEnabled: context.capabilityEnabled,
    configured: context.configured,
    production: context.production,
  });
  if (!gate.ok || !context.session?.tenantId || !context.config) {
    return NextResponse.json({ error: gate.ok ? "unconfigured" : gate.reason }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const selected = normalizeSelection(body);
  if (!selected) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const stored = await readMetaAccessToken(context.session.tenantId);
  if (!stored.ok) return NextResponse.json({ error: "missing" }, { status: 409 });
  const discovered = await fetchMetaPages({
    config: context.config,
    accessToken: stored.accessToken,
  });
  if (!discovered.ok) return NextResponse.json({ error: discovered.reason }, { status: 502 });
  const plan = planMetaDestinationSave(discovered.pages, selected);
  if (!plan.ok) return NextResponse.json({ error: plan.reason }, { status: 400 });
  const saved = await replaceMetaDestinations({
    tenantId: context.session.tenantId,
    connectionId: stored.connectionId,
    rows: plan.rows,
  });
  if (!saved) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, status: "connected" });
}

export async function disconnectMeta(request: Request) {
  const blocked = await metaProductionBlocked();
  if (blocked) return blocked;
  const context = await loadMetaRequestContext();
  const limited = await metaRateLimit(
    request,
    "meta-oauth-disconnect",
    context.session?.user.id ?? "anonymous",
  );
  if (limited) return limited;
  if (!context.session?.user || !context.session.tenantId) {
    return NextResponse.redirect("https://staging.frizeo.ro/login", 303);
  }
  const gate = decideMetaConnect({
    authenticated: true,
    role: context.session.role,
    capabilityEnabled: true,
    configured: true,
    production: context.production,
  });
  if (!gate.ok) return metaSettingsRedirect(gate.reason === "forbidden" ? "forbidden" : "production");

  const stored = await readMetaAccessToken(context.session.tenantId);
  let attempted = false;
  let remoteConfirmed = false;
  if (stored.ok && context.config) {
    attempted = true;
    const remote = await revokeMetaPermissions({
      config: context.config,
      accessToken: stored.accessToken,
    });
    remoteConfirmed = remote === "confirmed";
  }
  const removed = await deleteMetaConnection(context.session.tenantId);
  if (!removed) return metaSettingsRedirect("invalid");
  return metaSettingsRedirect(planDisconnect({ attempted, remoteConfirmed }).notice);
}

function normalizeSelection(body: unknown): { type: "facebook_page" | "instagram_business"; id: string }[] | null {
  if (!body || typeof body !== "object") return null;
  const rows = (body as { destinations?: unknown }).destinations;
  if (!Array.isArray(rows) || rows.length > 50) return null;
  const selected: { type: "facebook_page" | "instagram_business"; id: string }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return null;
    const type = (row as { type?: unknown }).type;
    const id = (row as { id?: unknown }).id;
    if (type !== "facebook_page" && type !== "instagram_business") return null;
    if (typeof id !== "string" || !/^[0-9]+$/.test(id)) return null;
    selected.push({ type, id });
  }
  return selected;
}

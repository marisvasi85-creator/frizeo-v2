import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import {
  META_GRAPH_VERSION,
  META_REQUIRED_SCOPES,
  type MetaReadyConfig,
} from "@/lib/integrations/meta/config";
import type { ConnectionStatus } from "@/lib/integrations/types";

export type MetaGateReason =
  | "unauthenticated"
  | "forbidden"
  | "capability_off"
  | "unconfigured"
  | "production";

export function decideMetaConnect(input: {
  authenticated: boolean;
  role: string | null;
  capabilityEnabled: boolean;
  configured: boolean;
  production: boolean;
}): { ok: true } | { ok: false; reason: MetaGateReason } {
  if (!input.authenticated) return { ok: false, reason: "unauthenticated" };
  if (input.production) return { ok: false, reason: "production" };
  if (!input.configured) return { ok: false, reason: "unconfigured" };
  if (!canAdministerIntegrations(input.role)) return { ok: false, reason: "forbidden" };
  if (!input.capabilityEnabled) return { ok: false, reason: "capability_off" };
  return { ok: true };
}

export function buildMetaAuthorizeUrl(input: {
  config: Pick<MetaReadyConfig, "appId" | "configurationId" | "redirectUri">;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", input.config.appId);
  url.searchParams.set("redirect_uri", input.config.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("config_id", input.config.configurationId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("override_default_response_type", "true");
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function isBrowserSafeMetaRedirect(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.origin !== "https://www.facebook.com") return false;
  if (url.pathname !== `/${META_GRAPH_VERSION}/dialog/oauth`) return false;
  if (url.searchParams.get("response_type") !== "code") return false;
  if (!url.searchParams.get("config_id")) return false;
  if (!url.searchParams.get("state")) return false;
  if (!url.searchParams.get("code_challenge")) return false;
  for (const key of ["client_secret", "code_verifier", "access_token", "fb_exchange_token"]) {
    if (url.searchParams.has(key)) return false;
  }
  return true;
}

const SETTINGS_ORIGIN = "https://staging.frizeo.ro";

export function stagingSettingsUrl(query: Record<string, string>): string {
  const url = new URL("/admin/settings/integrations", SETTINGS_ORIGIN);
  for (const [key, value] of Object.entries(query)) {
    if (!/^[a-z0-9_]+$/.test(key) || !/^[a-z0-9_]+$/.test(value)) continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export type MetaNotice =
  | "select"
  | "denied"
  | "expired"
  | "consumed"
  | "mismatch"
  | "exchange_failed"
  | "permissions"
  | "unconfigured"
  | "timeout"
  | "capability"
  | "production"
  | "forbidden"
  | "disconnected_remote"
  | "disconnected_local_only"
  | "saved"
  | "no_pages"
  | "invalid"
  | "unknown_expiry"
  | "token_expired";

export function metaCallbackError(params: URLSearchParams): "denied" | "meta_error" | null {
  const error = params.get("error");
  if (!error) return null;
  if (error === "access_denied") return "denied";
  return "meta_error";
}

export function missingRequiredScopes(scopes: readonly string[]): string[] {
  return META_REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
}

export type DebugTokenResult =
  | {
      ok: true;
      userId: string;
      scopes: string[];
      expiresAt: string | null;
      dataAccessExpiresAt: string | null;
    }
  | { ok: false; reason: "invalid_token" | "wrong_app" };

function finiteUnixExpiry(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

export function parseDebugToken(body: unknown, expectedAppId: string): DebugTokenResult {
  if (!body || typeof body !== "object") return { ok: false, reason: "invalid_token" };
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object") return { ok: false, reason: "invalid_token" };
  const record = data as {
    app_id?: unknown;
    is_valid?: unknown;
    user_id?: unknown;
    scopes?: unknown;
    granular_scopes?: unknown;
    expires_at?: unknown;
    data_access_expires_at?: unknown;
    type?: unknown;
  };
  if (String(record.app_id ?? "") !== expectedAppId) return { ok: false, reason: "wrong_app" };
  if (record.is_valid !== true) return { ok: false, reason: "invalid_token" };
  if (record.type && record.type !== "USER") return { ok: false, reason: "invalid_token" };
  const userId = typeof record.user_id === "string" || typeof record.user_id === "number"
    ? String(record.user_id)
    : "";
  if (!/^[0-9]+$/.test(userId)) return { ok: false, reason: "invalid_token" };
  const directScopes = Array.isArray(record.scopes)
    ? record.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];
  const granular = Array.isArray(record.granular_scopes)
    ? record.granular_scopes.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const scope = (entry as { scope?: unknown }).scope;
        return typeof scope === "string" ? [scope] : [];
      })
    : [];
  const scopes = [...new Set([...directScopes, ...granular])];
  return {
    ok: true,
    userId,
    scopes,
    expiresAt: finiteUnixExpiry(record.expires_at),
    dataAccessExpiresAt: finiteUnixExpiry(record.data_access_expires_at),
  };
}

export type TokenExpiryDecision =
  | { ok: true; expiresAt: string }
  | { ok: false; reason: "unknown_expiry" | "token_expired" };

export function resolveUserTokenExpiry(input: {
  expiresInSeconds: number | null;
  debugExpiresAt: string | null;
  dataAccessExpiresAt: string | null;
  now: Date;
}): TokenExpiryDecision {
  const candidates: number[] = [];
  if (
    typeof input.expiresInSeconds === "number" &&
    Number.isFinite(input.expiresInSeconds) &&
    input.expiresInSeconds > 0
  ) {
    candidates.push(input.now.getTime() + input.expiresInSeconds * 1000);
  }
  for (const value of [input.debugExpiresAt, input.dataAccessExpiresAt]) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) candidates.push(parsed);
  }
  if (candidates.length === 0) return { ok: false, reason: "unknown_expiry" };
  const earliest = Math.min(...candidates);
  if (earliest <= input.now.getTime()) return { ok: false, reason: "token_expired" };
  return { ok: true, expiresAt: new Date(earliest).toISOString() };
}

export function assessStoredTokenExpiry(
  expiresAt: string | null,
  now = new Date(),
): TokenExpiryDecision {
  if (!expiresAt) return { ok: false, reason: "unknown_expiry" };
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) return { ok: false, reason: "unknown_expiry" };
  if (parsed <= now.getTime()) return { ok: false, reason: "token_expired" };
  return { ok: true, expiresAt };
}

export function parseAccessTokenBody(body: unknown):
  | { ok: true; accessToken: string; expiresIn: number | null }
  | { ok: false } {
  if (!body || typeof body !== "object") return { ok: false };
  const token = (body as { access_token?: unknown }).access_token;
  if (typeof token !== "string" || token.length < 8) return { ok: false };
  const expiresIn = (body as { expires_in?: unknown }).expires_in;
  return {
    ok: true,
    accessToken: token,
    expiresIn: typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : null,
  };
}

export type MetaPage = {
  id: string;
  name: string;
  tasks: string[];
  instagram: { id: string; username: string | null } | null;
};

const ACCOUNTS_CURSOR = /^[A-Za-z0-9+/=_-]{1,512}$/;

export function readAccountsCursor(next: unknown):
  | { ok: true; after: string | null }
  | { ok: false; reason: "invalid_paging" } {
  if (next == null) return { ok: true, after: null };
  if (typeof next !== "string" || next.length === 0 || next.length > 2000) {
    return { ok: false, reason: "invalid_paging" };
  }
  let url: URL;
  try {
    url = new URL(next);
  } catch {
    return { ok: false, reason: "invalid_paging" };
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    return { ok: false, reason: "invalid_paging" };
  }
  if (url.hostname !== "graph.facebook.com") return { ok: false, reason: "invalid_paging" };
  if (url.port && url.port !== "443") return { ok: false, reason: "invalid_paging" };
  if (!new RegExp(`^/${META_GRAPH_VERSION}/(?:me|[0-9]+)/accounts$`).test(url.pathname)) {
    return { ok: false, reason: "invalid_paging" };
  }
  const after = url.searchParams.get("after");
  if (!after || !ACCOUNTS_CURSOR.test(after)) return { ok: false, reason: "invalid_paging" };
  return { ok: true, after };
}

export function parseMetaPages(body: unknown): MetaPage[] {
  if (!body || typeof body !== "object") return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const pages: MetaPage[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const page = row as {
      id?: unknown;
      name?: unknown;
      tasks?: unknown;
      instagram_business_account?: unknown;
    };
    if (typeof page.id !== "string" || !/^[0-9]+$/.test(page.id)) continue;
    if (typeof page.name !== "string" || page.name.trim().length === 0) continue;
    const tasks = Array.isArray(page.tasks)
      ? page.tasks.filter((task): task is string => typeof task === "string").slice(0, 20)
      : [];
    let instagram: MetaPage["instagram"] = null;
    const ig = page.instagram_business_account;
    if (ig && typeof ig === "object") {
      const account = ig as { id?: unknown; username?: unknown };
      if (typeof account.id === "string" && /^[0-9]+$/.test(account.id)) {
        instagram = {
          id: account.id,
          username: typeof account.username === "string" ? account.username.slice(0, 80) : null,
        };
      }
    }
    pages.push({ id: page.id, name: page.name.slice(0, 200), tasks, instagram });
  }
  return pages;
}

export type DestinationDraft = {
  destination_type: "facebook_page" | "instagram_business";
  provider_destination_id: string;
  display_name: string;
  metadata: Record<string, unknown>;
};

export function planMetaDestinationSave(
  pages: readonly MetaPage[],
  selected: readonly { type: "facebook_page" | "instagram_business"; id: string }[],
):
  | { ok: true; rows: DestinationDraft[] }
  | { ok: false; reason: "empty" | "unknown_destination" | "instagram_without_page" } {
  if (selected.length === 0) return { ok: false, reason: "empty" };
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const selectedPages = new Set(
    selected.filter((item) => item.type === "facebook_page").map((item) => item.id),
  );
  const rows: DestinationDraft[] = [];
  const seen = new Set<string>();

  for (const item of selected) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (item.type === "facebook_page") {
      const page = pageById.get(item.id);
      if (!page) return { ok: false, reason: "unknown_destination" };
      rows.push({
        destination_type: "facebook_page",
        provider_destination_id: page.id,
        display_name: page.name,
        metadata: { tasks: page.tasks },
      });
      continue;
    }
    const owner = pages.find((page) => page.instagram?.id === item.id);
    if (!owner?.instagram) return { ok: false, reason: "unknown_destination" };
    if (!selectedPages.has(owner.id)) return { ok: false, reason: "instagram_without_page" };
    rows.push({
      destination_type: "instagram_business",
      provider_destination_id: owner.instagram.id,
      display_name: owner.instagram.username
        ? `@${owner.instagram.username}`
        : `Instagram ${owner.instagram.id}`,
      metadata: {
        username: owner.instagram.username,
        facebook_page_id: owner.id,
      },
    });
  }

  if (rows.length === 0) return { ok: false, reason: "empty" };
  return { ok: true, rows };
}

export function planCallbackPersistence(input: {
  exchangeOk: boolean;
  permissionsOk: boolean;
}):
  | { persist: false; notice: "exchange_failed" | "timeout" }
  | { persist: true; status: "setup_required"; notice: "select"; lastError: null }
  | { persist: true; status: "error"; notice: "permissions"; lastError: "missing_required_permissions" } {
  if (!input.exchangeOk) return { persist: false, notice: "exchange_failed" };
  if (!input.permissionsOk) {
    return {
      persist: true,
      status: "error",
      notice: "permissions",
      lastError: "missing_required_permissions",
    };
  }
  return { persist: true, status: "setup_required", notice: "select", lastError: null };
}

export function planMetaUpsert(existingConnectionId: string | null): {
  mode: "insert" | "update";
  connectionId: string | null;
} {
  if (existingConnectionId) return { mode: "update", connectionId: existingConnectionId };
  return { mode: "insert", connectionId: null };
}

export function effectiveMetaStatus(
  status: ConnectionStatus | null,
  tokenExpiresAt: string | null,
  now = new Date(),
): ConnectionStatus | "not_connected" {
  if (!status) return "not_connected";
  if (status === "connected" || status === "setup_required") {
    const decision = assessStoredTokenExpiry(tokenExpiresAt, now);
    if (!decision.ok) return "needs_reconnect";
  }
  return status;
}

export function planDisconnect(input: {
  attempted: boolean;
  remoteConfirmed: boolean;
}): { local: "removed"; remoteRevocation: "confirmed" | "failed" | "not_attempted"; notice: MetaNotice } {
  if (!input.attempted) {
    return { local: "removed", remoteRevocation: "not_attempted", notice: "disconnected_local_only" };
  }
  if (input.remoteConfirmed) {
    return { local: "removed", remoteRevocation: "confirmed", notice: "disconnected_remote" };
  }
  return { local: "removed", remoteRevocation: "failed", notice: "disconnected_local_only" };
}

const SECRET_KEY = /access_token|refresh_token|client_secret|code_verifier|pkce|ciphertext|nonce|authorization|api_key|secret|token/i;

export function containsSecretMaterial(value: unknown): boolean {
  if (typeof value === "string") {
    return value.includes("EAA") || /access_token=/.test(value);
  }
  if (Array.isArray(value)) return value.some((item) => containsSecretMaterial(item));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    if (SECRET_KEY.test(key)) return true;
    return containsSecretMaterial(nested);
  });
}

export function presentMetaDestination(input: {
  destinationType: string;
  displayName: string | null;
  metadata: unknown;
}): { title: string; detail: string | null } {
  const metadata = input.metadata && typeof input.metadata === "object"
    ? input.metadata as Record<string, unknown>
    : {};
  if (input.destinationType === "instagram_business") {
    const username = typeof metadata.username === "string" ? metadata.username : null;
    const pageId = typeof metadata.facebook_page_id === "string" ? metadata.facebook_page_id : null;
    return {
      title: input.displayName ?? (username ? `@${username}` : "Instagram"),
      detail: pageId ? `Pagina Facebook ${pageId}` : null,
    };
  }
  const tasks = Array.isArray(metadata.tasks)
    ? metadata.tasks.filter((task): task is string => typeof task === "string")
    : [];
  return {
    title: input.displayName ?? "Pagină Facebook",
    detail: tasks.length > 0 ? tasks.join(", ") : null,
  };
}

export function encodeStoredToken(accessToken: string, obtainedAt: string): string {
  return JSON.stringify({ access_token: accessToken, obtained_at: obtainedAt });
}

export function readStoredToken(plaintext: string): string | null {
  try {
    const parsed = JSON.parse(plaintext) as { access_token?: unknown };
    return typeof parsed.access_token === "string" && parsed.access_token.length > 0
      ? parsed.access_token
      : null;
  } catch {
    return null;
  }
}

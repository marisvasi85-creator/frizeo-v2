import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import { bookingLinkForRealPublish } from "@/lib/marketing-ai/publishCardCopy";
import {
  GOOGLE_BUSINESS_AUTHORIZE_URL,
  GOOGLE_BUSINESS_SCOPE,
  isGoogleAccountName,
  isGoogleLocationId,
  isGooglePostId,
  type GoogleBusinessConfig,
} from "@/lib/integrations/google-business/config";

export const GOOGLE_BUSINESS_SUMMARY_MAX = 1500;

export type GoogleNotice =
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
  | "disconnected"
  | "saved"
  | "no_locations"
  | "invalid"
  | "unknown_expiry"
  | "calendar_scope";

export type GoogleBusinessAccount = {
  name: string;
  accountName: string;
};

export type GoogleBusinessLocation = {
  id: string;
  title: string;
  accountName: string;
};

export type GoogleConnectDecision =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "production" | "unconfigured" | "forbidden" | "capability_off" };

export function decideGoogleConnect(input: {
  authenticated: boolean;
  role: string | null;
  capabilityEnabled: boolean;
  configured: boolean;
  production: boolean;
}): GoogleConnectDecision {
  if (!input.authenticated) return { ok: false, reason: "unauthenticated" };
  if (input.production) return { ok: false, reason: "production" };
  if (!input.configured) return { ok: false, reason: "unconfigured" };
  if (!canAdministerIntegrations(input.role)) return { ok: false, reason: "forbidden" };
  if (!input.capabilityEnabled) return { ok: false, reason: "capability_off" };
  return { ok: true };
}

export function buildGoogleAuthorizeUrl(input: {
  config: Pick<GoogleBusinessConfig, "clientId" | "redirectUri" | "scope">;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(GOOGLE_BUSINESS_AUTHORIZE_URL);
  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("redirect_uri", input.config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.config.scope);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  return url.toString();
}

export function stagingGoogleSettingsUrl(params: Record<string, string>): string {
  const url = new URL("https://staging.frizeo.ro/admin/settings/integrations");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function parseGoogleAccounts(body: unknown): GoogleBusinessAccount[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { accounts?: unknown }).accounts)) {
    return [];
  }
  const rows: GoogleBusinessAccount[] = [];
  for (const item of (body as { accounts: unknown[] }).accounts) {
    if (!item || typeof item !== "object") continue;
    const name = text((item as { name?: unknown }).name);
    const accountName = text((item as { accountName?: unknown }).accountName);
    if (!name || !accountName || !isGoogleAccountName(name)) continue;
    rows.push({ name, accountName });
  }
  return rows;
}

export function parseGoogleLocations(body: unknown, accountName: string): GoogleBusinessLocation[] {
  if (!isGoogleAccountName(accountName)) return [];
  if (!body || typeof body !== "object" || !Array.isArray((body as { locations?: unknown }).locations)) {
    return [];
  }
  const rows: GoogleBusinessLocation[] = [];
  for (const item of (body as { locations: unknown[] }).locations) {
    if (!item || typeof item !== "object") continue;
    const name = text((item as { name?: unknown }).name);
    const title = text((item as { title?: unknown }).title);
    if (!name || !title || !/^locations\/[0-9]{1,30}$/.test(name)) continue;
    const id = `${accountName}/${name}`;
    if (!isGoogleLocationId(id)) continue;
    rows.push({ id, title: title.slice(0, 120), accountName });
  }
  return rows;
}

export type ParsedGoogleToken =
  | { ok: true; accessToken: string; refreshToken: string; expiresIn: number }
  | {
      ok: false;
      reason: "invalid_token" | "missing_scope" | "calendar_scope" | "missing_refresh" | "missing_expiry";
    };

export function parseGoogleToken(body: unknown): ParsedGoogleToken {
  if (!body || typeof body !== "object") return { ok: false, reason: "invalid_token" };
  const record = body as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    scope?: unknown;
  };
  const accessToken = text(record.access_token);
  const refreshToken = text(record.refresh_token);
  const scope = text(record.scope);
  if (!accessToken || !scope) return { ok: false, reason: "invalid_token" };
  const scopes = scope.split(/\s+/);
  if (scopes.some((item) => item.toLowerCase().includes("calendar"))) {
    return { ok: false, reason: "calendar_scope" };
  }
  if (scopes.length !== 1 || scopes[0] !== GOOGLE_BUSINESS_SCOPE) {
    return { ok: false, reason: "missing_scope" };
  }
  if (!refreshToken) return { ok: false, reason: "missing_refresh" };
  if (typeof record.expires_in !== "number" || !Number.isFinite(record.expires_in) || record.expires_in <= 0) {
    return { ok: false, reason: "missing_expiry" };
  }
  return { ok: true, accessToken, refreshToken, expiresIn: record.expires_in };
}

export function encodeGoogleToken(input: {
  accessToken: string;
  refreshToken: string;
  obtainedAt: string;
}): string {
  return JSON.stringify({
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    obtained_at: input.obtainedAt,
  });
}

export function readGoogleToken(serialized: string): { accessToken: string; refreshToken: string } | null {
  try {
    const parsed = JSON.parse(serialized) as { access_token?: unknown; refresh_token?: unknown };
    const accessToken = text(parsed.access_token);
    const refreshToken = text(parsed.refresh_token);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

export function publicGoogleConnection(input: {
  displayName: string | null;
  status: string;
  scopes: string[];
}): { displayName: string | null; status: string; scopes: string[] } {
  return {
    displayName: input.displayName,
    status: input.status,
    scopes: input.scopes.filter((scope) => scope === GOOGLE_BUSINESS_SCOPE),
  };
}

export function planGoogleDestinationSave(input: {
  tenantId: string;
  discovered: readonly GoogleBusinessLocation[];
  selectedIds: readonly string[];
}):
  | { ok: true; rows: Array<{
      destination_type: "google_business_location";
      provider_destination_id: string;
      display_name: string;
      account_name: string;
    }> }
  | { ok: false; reason: "empty" | "unknown_destination" } {
  if (!input.tenantId || input.selectedIds.length === 0) return { ok: false, reason: "empty" };
  const allowed = new Map(input.discovered.map((location) => [location.id, location]));
  const seen = new Set<string>();
  const rows = [];
  for (const id of input.selectedIds) {
    const location = allowed.get(id);
    if (!location || seen.has(id) || !isGoogleLocationId(id)) {
      return { ok: false, reason: "unknown_destination" };
    }
    seen.add(id);
    rows.push({
      destination_type: "google_business_location" as const,
      provider_destination_id: location.id,
      display_name: location.title,
      account_name: location.accountName,
    });
  }
  return { ok: true, rows };
}

export function googleBookAction(bookingUrl: string | null | undefined): { actionType: "BOOK"; url: string } | null {
  const url = bookingLinkForRealPublish(bookingUrl);
  if (!url) return null;
  return { actionType: "BOOK", url };
}

export type GooglePublishJobView = {
  id: string;
  assetId: string;
  destinationId: string;
  destinationType: "google_business_location";
  displayName: string | null;
  status: string;
  executionMode: "mock";
  safeError: string | null;
  providerContainerId: null;
  providerPostId: string | null;
  caption: string | null;
};

export function presentGooglePublishJob(value: unknown): GooglePublishJobView | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.destination_type !== "google_business_location") return null;
  if (row.execution_mode !== "mock") return null;
  if (typeof row.id !== "string" || typeof row.asset_id !== "string" || typeof row.destination_id !== "string") {
    return null;
  }
  const postId = row.provider_post_id;
  if (postId !== null && postId !== undefined && (typeof postId !== "string" || !isGooglePostId(postId))) {
    return null;
  }
  return {
    id: row.id,
    assetId: row.asset_id,
    destinationId: row.destination_id,
    destinationType: "google_business_location",
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    status: typeof row.status === "string" ? row.status : "draft",
    executionMode: "mock",
    safeError: typeof row.safe_error === "string" ? row.safe_error : null,
    providerContainerId: null,
    providerPostId: typeof postId === "string" ? postId : null,
    caption: typeof row.caption === "string" ? row.caption : null,
  };
}

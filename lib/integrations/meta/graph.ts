import { createHmac } from "node:crypto";
import { META_GRAPH_VERSION, type MetaReadyConfig } from "@/lib/integrations/meta/config";
import {
  missingRequiredScopes,
  parseAccessTokenBody,
  parseDebugToken,
  parseMetaPages,
  readAccountsCursor,
  resolveUserTokenExpiry,
  type MetaPage,
} from "@/lib/integrations/meta/flow";

const GRAPH_ORIGIN = "https://graph.facebook.com";
export const GRAPH_BUDGET_MS = 8000;
export const GRAPH_CALL_MAX_MS = 1500;
export const GRAPH_CALL_MIN_MS = 500;
export const MAX_ACCOUNT_PAGES = 4;
export const MAX_ACCOUNT_RESULTS = 100;

export type GraphBudget = { remainingMs: number };

export function createGraphBudget(totalMs = GRAPH_BUDGET_MS): GraphBudget {
  return { remainingMs: totalMs };
}

export function reserveGraphCall(budget: GraphBudget, capMs = GRAPH_CALL_MAX_MS): number | null {
  if (budget.remainingMs < GRAPH_CALL_MIN_MS) return null;
  const timeoutMs = Math.min(capMs, budget.remainingMs);
  budget.remainingMs -= timeoutMs;
  return timeoutMs;
}

export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

export type MetaHttp = (
  url: string,
  init: { method?: "GET" | "DELETE"; headers?: Record<string, string>; timeoutMs: number },
) => Promise<{ ok: boolean; status: number; body: unknown } | { ok: false; timeout: true }>;

export function createMetaHttp(fetchImpl: typeof fetch = fetch): MetaHttp {
  return async (url, init) => {
    try {
      const response = await fetchImpl(url, {
        method: init.method ?? "GET",
        headers: init.headers,
        signal: AbortSignal.timeout(init.timeoutMs),
        cache: "no-store",
      });
      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = null;
        }
      }
      return { ok: response.ok, status: response.status, body };
    } catch {
      return { ok: false, timeout: true };
    }
  };
}

function graphUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${GRAPH_ORIGIN}/${META_GRAPH_VERSION}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export type ExchangedMetaToken =
  | {
      ok: true;
      accessToken: string;
      expiresAt: string;
      scopes: string[];
      userId: string;
      displayName: string | null;
      permissionsOk: boolean;
    }
  | {
      ok: false;
      reason: "timeout" | "exchange_failed" | "invalid_token" | "unknown_expiry" | "token_expired";
    };

export async function exchangeMetaAuthorization(input: {
  config: MetaReadyConfig;
  code: string;
  codeVerifier: string;
  now?: Date;
  http?: MetaHttp;
  budget?: GraphBudget;
}): Promise<ExchangedMetaToken> {
  const http = input.http ?? createMetaHttp();
  const now = input.now ?? new Date();
  const budget = input.budget ?? createGraphBudget();
  const exchangeTimeout = reserveGraphCall(budget);
  if (exchangeTimeout == null) return { ok: false, reason: "timeout" };
  const exchange = await http(
    graphUrl("oauth/access_token", {
      client_id: input.config.appId,
      redirect_uri: input.config.redirectUri,
      client_secret: input.config.appSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
    }),
    { timeoutMs: exchangeTimeout },
  );
  if ("timeout" in exchange) return { ok: false, reason: "timeout" };
  const shortLived = parseAccessTokenBody(exchange.body);
  if (!exchange.ok || !shortLived.ok) return { ok: false, reason: "exchange_failed" };

  const extendedTimeout = reserveGraphCall(budget);
  if (extendedTimeout == null) return { ok: false, reason: "timeout" };
  const extended = await http(
    graphUrl("oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: input.config.appId,
      client_secret: input.config.appSecret,
      fb_exchange_token: shortLived.accessToken,
    }),
    { timeoutMs: extendedTimeout },
  );
  if ("timeout" in extended) return { ok: false, reason: "timeout" };
  const longLived = extended.ok ? parseAccessTokenBody(extended.body) : { ok: false as const };
  const accessToken = longLived.ok ? longLived.accessToken : shortLived.accessToken;
  const expiresInSeconds = longLived.ok ? longLived.expiresIn : shortLived.expiresIn;

  const proof = appSecretProof(accessToken, input.config.appSecret);
  const debugTimeout = reserveGraphCall(budget);
  if (debugTimeout == null) return { ok: false, reason: "timeout" };
  const debug = await http(
    graphUrl("debug_token", {
      input_token: accessToken,
      access_token: `${input.config.appId}|${input.config.appSecret}`,
    }),
    { timeoutMs: debugTimeout },
  );
  if ("timeout" in debug) return { ok: false, reason: "timeout" };
  const inspected = parseDebugToken(debug.body, input.config.appId);
  if (!debug.ok || !inspected.ok) return { ok: false, reason: "invalid_token" };
  const expiry = resolveUserTokenExpiry({
    expiresInSeconds,
    debugExpiresAt: inspected.expiresAt,
    dataAccessExpiresAt: inspected.dataAccessExpiresAt,
    now,
  });
  if (!expiry.ok) return { ok: false, reason: expiry.reason };

  let displayName: string | null = null;
  const profileTimeout = reserveGraphCall(budget);
  if (profileTimeout != null) {
    const profile = await http(
      graphUrl("me", { fields: "id,name", appsecret_proof: proof }),
      {
        timeoutMs: profileTimeout,
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!("timeout" in profile) && profile.ok && profile.body && typeof profile.body === "object") {
      const name = (profile.body as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) displayName = name.trim().slice(0, 200);
    }
  }

  return {
    ok: true,
    accessToken,
    expiresAt: expiry.expiresAt,
    scopes: inspected.scopes,
    userId: inspected.userId,
    displayName,
    permissionsOk: missingRequiredScopes(inspected.scopes).length === 0,
  };
}

export async function fetchMetaPages(input: {
  config: MetaReadyConfig;
  accessToken: string;
  http?: MetaHttp;
  budget?: GraphBudget;
}): Promise<
  | { ok: true; pages: MetaPage[] }
  | { ok: false; reason: "timeout" | "graph_error" | "invalid_paging" | "page_limit" }
> {
  const http = input.http ?? createMetaHttp();
  const budget = input.budget ?? createGraphBudget();
  const proof = appSecretProof(input.accessToken, input.config.appSecret);
  const pages: MetaPage[] = [];
  const seenCursors = new Set<string>();
  let after: string | null = null;

  for (let pageIndex = 0; pageIndex < MAX_ACCOUNT_PAGES; pageIndex += 1) {
    const timeoutMs = reserveGraphCall(budget);
    if (timeoutMs == null) return { ok: false, reason: "timeout" };
    const params: Record<string, string> = {
      fields: "id,name,tasks,instagram_business_account{id,username}",
      appsecret_proof: proof,
      limit: "50",
    };
    if (after) params.after = after;
    const response = await http(graphUrl("me/accounts", params), {
      timeoutMs,
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
    if ("timeout" in response) return { ok: false, reason: "timeout" };
    if (!response.ok) return { ok: false, reason: "graph_error" };
    const batch = parseMetaPages(response.body);
    if (pages.length + batch.length > MAX_ACCOUNT_RESULTS) return { ok: false, reason: "page_limit" };
    pages.push(...batch);
    const paging = response.body && typeof response.body === "object"
      ? (response.body as { paging?: { next?: unknown } }).paging
      : undefined;
    const cursor = readAccountsCursor(paging?.next);
    if (!cursor.ok) return { ok: false, reason: "invalid_paging" };
    if (!cursor.after) return { ok: true, pages };
    if (seenCursors.has(cursor.after)) return { ok: false, reason: "invalid_paging" };
    seenCursors.add(cursor.after);
    after = cursor.after;
  }

  return { ok: false, reason: "page_limit" };
}

export async function revokeMetaPermissions(input: {
  config: MetaReadyConfig;
  accessToken: string;
  http?: MetaHttp;
  budget?: GraphBudget;
}): Promise<"confirmed" | "failed" | "timeout"> {
  const http = input.http ?? createMetaHttp();
  const budget = input.budget ?? createGraphBudget();
  const timeoutMs = reserveGraphCall(budget);
  if (timeoutMs == null) return "timeout";
  const proof = appSecretProof(input.accessToken, input.config.appSecret);
  const response = await http(
    graphUrl("me/permissions", { appsecret_proof: proof }),
    {
      method: "DELETE",
      timeoutMs,
      headers: { Authorization: `Bearer ${input.accessToken}` },
    },
  );
  if ("timeout" in response) return "timeout";
  if (!response.ok || !response.body || typeof response.body !== "object") return "failed";
  return (response.body as { success?: unknown }).success === true ? "confirmed" : "failed";
}

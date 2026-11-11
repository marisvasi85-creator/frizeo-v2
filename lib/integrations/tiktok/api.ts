import {
  TIKTOK_TOKEN_URL,
  TIKTOK_USER_INFO_URL,
  type TikTokConfig,
} from "@/lib/integrations/tiktok/config";
import {
  parseTikTokToken,
  parseTikTokUser,
  redactTikTokErrorMessage,
  type ParsedTikTokToken,
  type TikTokConsent,
} from "@/lib/integrations/tiktok/flow";

export type TikTokHttp = (input: {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ status: number; body: unknown }>;

export function createTikTokHttp(fetchImpl: typeof fetch = fetch): TikTokHttp {
  return async (input) => {
    const response = await fetchImpl(input.url, {
      method: input.method,
      headers: input.headers,
      body: input.body,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  };
}

function logTikTokFailure(event: string, status: number | null, body: unknown, secret: string): void {
  const record = body && typeof body === "object" ? body as {
    error?: unknown;
    error_description?: unknown;
    message?: unknown;
  } : null;
  const nested = record?.error && typeof record.error === "object"
    ? record.error as { code?: unknown; message?: unknown }
    : null;
  const code = typeof record?.error === "string"
    ? record.error
    : typeof nested?.code === "string" ? nested.code : null;
  const message = typeof record?.error_description === "string"
    ? record.error_description
    : typeof nested?.message === "string"
      ? nested.message
      : typeof record?.message === "string" ? record.message : null;
  console.error(JSON.stringify({
    source: event,
    httpStatus: status,
    tikTokCode: code,
    tikTokMessage: redactTikTokErrorMessage(message, secret),
  }));
}

export async function exchangeTikTokCode(input: {
  http: TikTokHttp;
  config: TikTokConfig;
  code: string;
  codeVerifier: string;
  consent?: TikTokConsent;
}): Promise<ParsedTikTokToken | { ok: false; reason: "network" }> {
  let response: { status: number; body: unknown };
  try {
    const body = new URLSearchParams({
      client_key: input.config.clientKey,
      client_secret: input.config.clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.config.redirectUri,
      code_verifier: input.codeVerifier,
    });
    response = await input.http({
      url: TIKTOK_TOKEN_URL,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    logTikTokFailure("tiktok_token_exchange", null, null, input.config.clientSecret);
    return { ok: false, reason: "network" };
  }
  if (response.status < 200 || response.status >= 300) {
    logTikTokFailure("tiktok_token_exchange", response.status, response.body, input.config.clientSecret);
    return { ok: false, reason: "invalid_token" };
  }
  const parsed = parseTikTokToken(response.body, input.consent ?? "identity");
  if (!parsed.ok) {
    logTikTokFailure("tiktok_token_exchange", response.status, response.body, input.config.clientSecret);
  }
  return parsed;
}

export async function fetchTikTokUser(input: {
  http: TikTokHttp;
  accessToken: string;
  openId: string;
}): Promise<ReturnType<typeof parseTikTokUser> | { ok: false; reason: "network" }> {
  const url = new URL(TIKTOK_USER_INFO_URL);
  url.searchParams.set("fields", "open_id,display_name");
  let response: { status: number; body: unknown };
  try {
    response = await input.http({
      url: url.toString(),
      method: "GET",
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
  } catch {
    logTikTokFailure("tiktok_user_info", null, null, input.accessToken);
    return { ok: false, reason: "network" };
  }
  if (response.status < 200 || response.status >= 300) {
    logTikTokFailure("tiktok_user_info", response.status, response.body, input.accessToken);
    return { ok: false, reason: "invalid_account" };
  }
  const parsed = parseTikTokUser(response.body, input.openId);
  if (!parsed.ok) logTikTokFailure("tiktok_user_info", response.status, response.body, input.accessToken);
  return parsed;
}

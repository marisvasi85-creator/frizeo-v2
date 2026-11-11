import {
  GOOGLE_BUSINESS_TOKEN_URL,
  type GoogleBusinessConfig,
} from "@/lib/integrations/google-business/config";
import {
  classifyGoogleAccountsResponse,
  parseGoogleLocations,
  parseGoogleToken,
  type GoogleAccountsResult,
  type GoogleBusinessLocation,
  type ParsedGoogleToken,
} from "@/lib/integrations/google-business/flow";
import type { GoogleHttp } from "@/lib/integrations/google-business/publish";

export function createGoogleHttp(fetchImpl: typeof fetch = fetch): GoogleHttp {
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

export async function exchangeGoogleCode(input: {
  http: GoogleHttp;
  config: GoogleBusinessConfig;
  code: string;
  codeVerifier: string;
}): Promise<ParsedGoogleToken> {
  let response: { status: number; body: unknown };
  try {
    const body = new URLSearchParams({
      code: input.code,
      client_id: input.config.clientId,
      client_secret: input.config.clientSecret,
      redirect_uri: input.config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: input.codeVerifier,
    });
    response = await input.http({
      url: GOOGLE_BUSINESS_TOKEN_URL,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
  if (response.status < 200 || response.status >= 300) return { ok: false, reason: "invalid_token" };
  return parseGoogleToken(response.body);
}

function logGoogleAccountsFailure(result: Extract<GoogleAccountsResult, { ok: false }>, secret: string): void {
  console.error(JSON.stringify({
    source: "google_business_accounts",
    httpStatus: result.httpStatus,
    googleCode: result.googleCode,
    googleStatus: result.googleStatus,
    googleReason: result.googleReason,
    googleMessage: result.googleMessage?.includes(secret)
      ? result.googleMessage.split(secret).join("[redacted]")
      : result.googleMessage,
    reason: result.reason,
  }));
}

export async function listGoogleAccounts(input: {
  http: GoogleHttp;
  accessToken: string;
}): Promise<GoogleAccountsResult> {
  let response: { status: number; body: unknown };
  try {
    response = await input.http({
      url: "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      method: "GET",
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
  } catch {
    const failure: GoogleAccountsResult = {
      ok: false,
      reason: "network",
      httpStatus: null,
      googleCode: null,
      googleStatus: null,
      googleReason: null,
      googleMessage: null,
    };
    logGoogleAccountsFailure(failure, input.accessToken);
    return failure;
  }
  const result = classifyGoogleAccountsResponse(response.status, response.body);
  if (!result.ok) {
    if (result.googleMessage) {
      result.googleMessage = result.googleMessage.split(input.accessToken).join("[redacted]");
    }
    logGoogleAccountsFailure(result, input.accessToken);
  }
  return result;
}

export async function listGoogleLocations(input: {
  http: GoogleHttp;
  accessToken: string;
  accountName: string;
}): Promise<GoogleBusinessLocation[]> {
  const response = await input.http({
    url: `https://mybusinessbusinessinformation.googleapis.com/v1/${input.accountName}/locations?readMask=name,title&pageSize=100`,
    method: "GET",
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  if (response.status < 200 || response.status >= 300) return [];
  return parseGoogleLocations(response.body, input.accountName);
}

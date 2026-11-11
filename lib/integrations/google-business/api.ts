import {
  GOOGLE_BUSINESS_TOKEN_URL,
  type GoogleBusinessConfig,
} from "@/lib/integrations/google-business/config";
import {
  parseGoogleAccounts,
  parseGoogleLocations,
  parseGoogleToken,
  type GoogleBusinessAccount,
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

export async function listGoogleAccounts(input: {
  http: GoogleHttp;
  accessToken: string;
}): Promise<GoogleBusinessAccount[]> {
  const response = await input.http({
    url: "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    method: "GET",
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  if (response.status < 200 || response.status >= 300) return [];
  return parseGoogleAccounts(response.body);
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

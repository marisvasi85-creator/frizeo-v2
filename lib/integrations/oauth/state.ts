import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { readIntegrationEncryptionKey } from "@/lib/integrations/crypto";
import type { IntegrationProvider } from "@/lib/integrations/types";

const STATE_DOMAIN = "frizeo-oauth-state-v1";
const STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthStateIssue = {
  state: string;
  stateHash: string;
  expiresAt: string;
  pkceVerifier: string;
  pkceChallenge: string;
  provider: IntegrationProvider;
  tenantId: string;
  userId: string;
};

export function createOAuthState(input: {
  tenantId: string;
  userId: string;
  provider: IntegrationProvider;
  now?: Date;
}): OAuthStateIssue | { error: "oauth_unconfigured" } {
  const key = readIntegrationEncryptionKey();
  if (!key) return { error: "oauth_unconfigured" };

  const state = randomBytes(32).toString("base64url");
  const pkceVerifier = randomBytes(32).toString("base64url");
  const now = input.now ?? new Date();
  return {
    state,
    stateHash: hashOAuthState(state, key),
    expiresAt: new Date(now.getTime() + STATE_TTL_MS).toISOString(),
    pkceVerifier,
    pkceChallenge: pkceS256(pkceVerifier),
    provider: input.provider,
    tenantId: input.tenantId,
    userId: input.userId,
  };
}

export function hashOAuthState(state: string, key = readIntegrationEncryptionKey()): string {
  if (!key) return "";
  return createHmac("sha256", key).update(`${STATE_DOMAIN}:${state}`).digest("hex");
}

export function pkceS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export type OAuthCallbackDecision =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "oauth_unconfigured"
        | "state_mismatch"
        | "tenant_mismatch"
        | "user_mismatch"
        | "provider_mismatch"
        | "expired"
        | "consumed";
    };

export function assertOAuthCallback(input: {
  presentedState: string;
  storedStateHash: string;
  storedTenantId: string;
  sessionTenantId: string;
  storedUserId: string;
  sessionUserId: string;
  storedProvider: IntegrationProvider;
  presentedProvider: IntegrationProvider;
  expiresAt: string;
  consumedAt: string | null;
  now?: Date;
}): OAuthCallbackDecision {
  const key = readIntegrationEncryptionKey();
  if (!key) return { ok: false, reason: "oauth_unconfigured" };

  const computed = hashOAuthState(input.presentedState, key);
  const left = Buffer.from(computed);
  const right = Buffer.from(input.storedStateHash);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, reason: "state_mismatch" };
  }
  if (input.storedTenantId !== input.sessionTenantId) {
    return { ok: false, reason: "tenant_mismatch" };
  }
  if (input.storedUserId !== input.sessionUserId) {
    return { ok: false, reason: "user_mismatch" };
  }
  if (input.storedProvider !== input.presentedProvider) {
    return { ok: false, reason: "provider_mismatch" };
  }
  if (input.consumedAt) return { ok: false, reason: "consumed" };
  if (new Date(input.expiresAt).getTime() <= (input.now ?? new Date()).getTime()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

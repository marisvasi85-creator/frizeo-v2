import type { MetaReadyConfig } from "@/lib/integrations/meta/config";
import {
  assessStoredTokenExpiry,
  decideMetaConnect,
  metaCallbackError,
  planCallbackPersistence,
  type MetaGateReason,
  type MetaNotice,
} from "@/lib/integrations/meta/flow";

export type ConsumedOAuthState =
  | { outcome: "ok"; tenantId: string; userId: string; pkceCiphertext: string; pkceNonce: string }
  | { outcome: "missing" | "consumed" | "expired" | "provider_mismatch" };

export async function runMetaCallback(input: {
  query: URLSearchParams;
  session: { userId: string; tenantId: string; role: string | null } | null;
  capabilityEnabled: boolean;
  configured: boolean;
  production: boolean;
  config: MetaReadyConfig | null;
  consumeState: (state: string) => Promise<ConsumedOAuthState>;
  decryptPkce: (ciphertext: string, nonce: string) => string | null;
  exchangeCode: (code: string, verifier: string) => Promise<
    | {
        ok: true;
        accessToken: string;
        expiresAt: string | null;
        scopes: string[];
        userId: string;
        displayName: string | null;
        permissionsOk: boolean;
      }
    | {
        ok: false;
        reason: "timeout" | "exchange_failed" | "invalid_token" | "unknown_expiry" | "token_expired";
      }
  >;
  persist: (row: {
    status: "setup_required" | "error";
    providerAccountId: string;
    displayName: string | null;
    scopes: string[];
    expiresAt: string | null;
    lastError: string | null;
    accessToken: string;
  }) => Promise<boolean>;
}): Promise<{ notice: MetaNotice } | { http: 401 }> {
  const gate = decideMetaConnect({
    authenticated: Boolean(input.session),
    role: input.session?.role ?? null,
    capabilityEnabled: input.capabilityEnabled,
    configured: input.configured && Boolean(input.config),
    production: input.production,
  });
  if (!input.session) return { http: 401 };
  if (!gate.ok && gate.reason !== "capability_off" && gate.reason !== "forbidden") {
    return { notice: noticeForGate(gate.reason) };
  }

  const providerError = metaCallbackError(input.query);
  const state = input.query.get("state") ?? "";
  const code = input.query.get("code") ?? "";
  if (providerError) {
    if (state) await input.consumeState(state);
    return { notice: providerError === "denied" ? "denied" : "invalid" };
  }
  if (!state || !code) return { notice: "invalid" };

  const consumed = await input.consumeState(state);
  if (consumed.outcome === "expired") return { notice: "expired" };
  if (consumed.outcome === "consumed") return { notice: "consumed" };
  if (consumed.outcome === "provider_mismatch") return { notice: "mismatch" };
  if (consumed.outcome !== "ok") return { notice: "mismatch" };
  if (consumed.tenantId !== input.session.tenantId || consumed.userId !== input.session.userId) {
    return { notice: "mismatch" };
  }
  if (!gate.ok) return { notice: noticeForGate(gate.reason) };

  const verifier = input.decryptPkce(consumed.pkceCiphertext, consumed.pkceNonce);
  if (!verifier) return { notice: "exchange_failed" };

  const exchanged = await input.exchangeCode(code, verifier);
  if (!exchanged.ok) {
    if (exchanged.reason === "timeout" || exchanged.reason === "unknown_expiry" || exchanged.reason === "token_expired") {
      return { notice: exchanged.reason };
    }
    return { notice: "exchange_failed" };
  }
  const usable = assessStoredTokenExpiry(exchanged.expiresAt);
  if (!usable.ok) return { notice: usable.reason };

  const plan = planCallbackPersistence({
    exchangeOk: true,
    permissionsOk: exchanged.permissionsOk,
  });
  if (!plan.persist) return { notice: plan.notice };

  const saved = await input.persist({
    status: plan.status,
    providerAccountId: exchanged.userId,
    displayName: exchanged.displayName,
    scopes: exchanged.scopes,
    expiresAt: exchanged.expiresAt,
    lastError: plan.lastError,
    accessToken: exchanged.accessToken,
  });
  if (!saved) return { notice: "exchange_failed" };
  return { notice: plan.notice };
}

function noticeForGate(reason: MetaGateReason): MetaNotice {
  if (reason === "production") return "production";
  if (reason === "unconfigured") return "unconfigured";
  if (reason === "capability_off") return "capability";
  if (reason === "forbidden") return "forbidden";
  return "unconfigured";
}

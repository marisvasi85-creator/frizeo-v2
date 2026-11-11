import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "@/lib/integrations/crypto";
import {
  encodeGoogleToken,
  readGoogleToken,
} from "@/lib/integrations/google-business/flow";
import { supabaseAdmin } from "@/lib/supabase/admin";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export function encryptGoogleSecret(plaintext: string): { ciphertext: string; nonce: string } | null {
  const encrypted = encryptIntegrationSecret(plaintext);
  if ("error" in encrypted) return null;
  return {
    ciphertext: encrypted.ciphertext.toString("base64"),
    nonce: encrypted.nonce.toString("base64"),
  };
}

export function decryptGoogleSecret(ciphertext: string, nonce: string): string | null {
  const plaintext = decryptIntegrationSecret({
    ciphertext: Buffer.from(ciphertext, "base64"),
    nonce: Buffer.from(nonce, "base64"),
    keyVersion: 1,
  });
  return typeof plaintext === "string" && plaintext.length > 0 ? plaintext : null;
}

export async function insertGoogleOAuthState(input: {
  tenantId: string;
  userId: string;
  stateHash: string;
  pkceCiphertext: string;
  pkceNonce: string;
  expiresAt: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("google_business_oauth_state_insert", {
    p_tenant_id: input.tenantId,
    p_user_id: input.userId,
    p_state_hash: input.stateHash,
    p_pkce_ciphertext: input.pkceCiphertext,
    p_pkce_nonce: input.pkceNonce,
    p_expires_at: input.expiresAt,
  });
  if (error) {
    console.error("google_business_oauth_state_insert_failed");
    return false;
  }
  return true;
}

export async function consumeGoogleOAuthState(stateHash: string): Promise<
  | { outcome: "ok"; tenantId: string; userId: string; pkceCiphertext: string; pkceNonce: string }
  | { outcome: "missing" | "consumed" | "expired" | "provider_mismatch" }
> {
  const { data, error } = await supabaseAdmin.rpc("integration_oauth_state_consume", {
    p_state_hash: stateHash,
    p_provider: "google_business",
  });
  const row = asRecord(data);
  if (error || !row) return { outcome: "missing" };
  if (row.outcome === "ok" && row.provider === "google_business") {
    return {
      outcome: "ok",
      tenantId: String(row.tenant_id ?? ""),
      userId: String(row.user_id ?? ""),
      pkceCiphertext: String(row.pkce_ciphertext ?? ""),
      pkceNonce: String(row.pkce_nonce ?? ""),
    };
  }
  if (row.outcome === "consumed" || row.outcome === "expired" || row.outcome === "provider_mismatch") {
    return { outcome: row.outcome };
  }
  return { outcome: "missing" };
}

export async function upsertGoogleConnection(input: {
  tenantId: string;
  userId: string;
  providerAccountId: string;
  displayName: string;
  status: "setup_required" | "connected" | "error" | "needs_reconnect";
  scopes: string[];
  tokenExpiresAt: string;
  lastError: string | null;
  accessToken: string;
  refreshToken: string;
}): Promise<boolean> {
  const encrypted = encryptGoogleSecret(encodeGoogleToken({
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    obtainedAt: new Date().toISOString(),
  }));
  if (!encrypted) return false;
  const { error } = await supabaseAdmin.rpc("google_business_upsert_connection", {
    p_tenant_id: input.tenantId,
    p_provider_account_id: input.providerAccountId,
    p_display_name: input.displayName,
    p_status: input.status,
    p_scopes: input.scopes,
    p_connected_by: input.userId,
    p_token_expires_at: input.tokenExpiresAt,
    p_last_error: input.lastError,
    p_ciphertext: encrypted.ciphertext,
    p_nonce: encrypted.nonce,
    p_key_version: 1,
  });
  if (error) {
    console.error("google_business_upsert_connection_failed");
    return false;
  }
  return true;
}

export async function readGoogleAccessToken(tenantId: string): Promise<
  | { ok: true; connectionId: string; accessToken: string; refreshToken: string; expiresAt: string | null }
  | { ok: false; reason: "missing" | "decrypt_failed" }
> {
  const { data, error } = await supabaseAdmin.rpc("google_business_read_connection_secret", {
    p_tenant_id: tenantId,
  });
  const row = asRecord(data);
  if (error || !row || row.found !== true) return { ok: false, reason: "missing" };
  const plaintext = decryptGoogleSecret(String(row.ciphertext ?? ""), String(row.nonce ?? ""));
  const token = plaintext ? readGoogleToken(plaintext) : null;
  if (!token || typeof row.connection_id !== "string") return { ok: false, reason: "decrypt_failed" };
  return {
    ok: true,
    connectionId: row.connection_id,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: typeof row.token_expires_at === "string" ? row.token_expires_at : null,
  };
}

export async function replaceGoogleDestinations(input: {
  tenantId: string;
  connectionId: string;
  destinations: unknown;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("google_business_replace_destinations", {
    p_tenant_id: input.tenantId,
    p_connection_id: input.connectionId,
    p_destinations: input.destinations,
  });
  if (error) {
    console.error("google_business_replace_destinations_failed");
    return false;
  }
  return true;
}

export async function deleteGoogleConnection(tenantId: string): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("google_business_disconnect", {
    p_tenant_id: tenantId,
  });
  if (error) {
    console.error("google_business_disconnect_failed");
    return false;
  }
  return true;
}

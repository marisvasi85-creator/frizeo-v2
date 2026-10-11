import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "@/lib/integrations/crypto";
import type { ConsumedOAuthState } from "@/lib/integrations/meta/callback";
import { encodeStoredToken, readStoredToken } from "@/lib/integrations/meta/flow";
import { supabaseAdmin } from "@/lib/supabase/admin";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export async function insertMetaOAuthState(input: {
  tenantId: string;
  userId: string;
  stateHash: string;
  pkceCiphertext: string;
  pkceNonce: string;
  expiresAt: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("integration_oauth_state_insert", {
    p_tenant_id: input.tenantId,
    p_user_id: input.userId,
    p_state_hash: input.stateHash,
    p_pkce_ciphertext: input.pkceCiphertext,
    p_pkce_nonce: input.pkceNonce,
    p_expires_at: input.expiresAt,
  });
  if (error) {
    console.error("integration_oauth_state_insert_failed");
    return false;
  }
  return true;
}

export async function consumeMetaOAuthState(stateHash: string): Promise<ConsumedOAuthState> {
  const { data, error } = await supabaseAdmin.rpc("integration_oauth_state_consume", {
    p_state_hash: stateHash,
    p_provider: "meta",
  });
  const row = asRecord(data);
  if (error || !row) return { outcome: "missing" };
  const outcome = row.outcome;
  if (outcome === "ok") {
    return {
      outcome: "ok",
      tenantId: String(row.tenant_id ?? ""),
      userId: String(row.user_id ?? ""),
      pkceCiphertext: String(row.pkce_ciphertext ?? ""),
      pkceNonce: String(row.pkce_nonce ?? ""),
    };
  }
  if (outcome === "consumed" || outcome === "expired" || outcome === "provider_mismatch") {
    return { outcome };
  }
  return { outcome: "missing" };
}

export function encryptPkceVerifier(verifier: string): { ciphertext: string; nonce: string } | null {
  const encrypted = encryptIntegrationSecret(verifier);
  if ("error" in encrypted) return null;
  return {
    ciphertext: encrypted.ciphertext.toString("base64"),
    nonce: encrypted.nonce.toString("base64"),
  };
}

export function decryptPkceVerifier(ciphertext: string, nonce: string): string | null {
  const plaintext = decryptIntegrationSecret({
    ciphertext: Buffer.from(ciphertext, "base64"),
    nonce: Buffer.from(nonce, "base64"),
    keyVersion: 1,
  });
  return typeof plaintext === "string" && plaintext.length > 0 ? plaintext : null;
}

export async function upsertMetaConnection(input: {
  tenantId: string;
  userId: string;
  providerAccountId: string;
  displayName: string | null;
  status: "setup_required" | "error" | "connected";
  scopes: string[];
  expiresAt: string | null;
  lastError: string | null;
  accessToken: string;
}): Promise<boolean> {
  const encrypted = encryptIntegrationSecret(
    encodeStoredToken(input.accessToken, new Date().toISOString()),
  );
  if ("error" in encrypted) return false;
  const { error } = await supabaseAdmin.rpc("meta_upsert_connection", {
    p_tenant_id: input.tenantId,
    p_provider_account_id: input.providerAccountId,
    p_display_name: input.displayName,
    p_status: input.status,
    p_scopes: input.scopes,
    p_connected_by: input.userId,
    p_token_expires_at: input.expiresAt,
    p_last_error: input.lastError,
    p_ciphertext: encrypted.ciphertext.toString("base64"),
    p_nonce: encrypted.nonce.toString("base64"),
    p_key_version: encrypted.keyVersion,
  });
  if (error) {
    console.error("meta_upsert_connection_failed");
    return false;
  }
  return true;
}

export async function readMetaAccessToken(tenantId: string): Promise<
  | {
      ok: true;
      connectionId: string;
      status: string;
      expiresAt: string | null;
      accessToken: string;
    }
  | { ok: false; reason: "missing" | "decrypt_failed" }
> {
  const { data, error } = await supabaseAdmin.rpc("meta_read_connection_secret", {
    p_tenant_id: tenantId,
  });
  const row = asRecord(data);
  if (error || !row || row.found !== true) return { ok: false, reason: "missing" };
  if (typeof row.ciphertext !== "string" || typeof row.nonce !== "string") {
    return { ok: false, reason: "decrypt_failed" };
  }
  const plaintext = decryptIntegrationSecret({
    ciphertext: Buffer.from(row.ciphertext, "base64"),
    nonce: Buffer.from(row.nonce, "base64"),
    keyVersion: 1,
  });
  if (typeof plaintext !== "string") return { ok: false, reason: "decrypt_failed" };
  const accessToken = readStoredToken(plaintext);
  if (!accessToken) return { ok: false, reason: "decrypt_failed" };
  return {
    ok: true,
    connectionId: String(row.connection_id),
    status: String(row.status ?? ""),
    expiresAt: typeof row.token_expires_at === "string" ? row.token_expires_at : null,
    accessToken,
  };
}

export async function replaceMetaDestinations(input: {
  tenantId: string;
  connectionId: string;
  rows: unknown[];
}): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("meta_replace_destinations", {
    p_tenant_id: input.tenantId,
    p_connection_id: input.connectionId,
    p_destinations: input.rows,
  });
  if (error) {
    console.error("meta_replace_destinations_failed");
    return false;
  }
  return true;
}

export async function deleteMetaConnection(tenantId: string): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("meta_disconnect", {
    p_tenant_id: tenantId,
  });
  if (error) {
    console.error("meta_disconnect_failed");
    return false;
  }
  return true;
}

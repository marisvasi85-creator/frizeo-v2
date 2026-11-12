import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "@/lib/integrations/crypto";
import { encodeTikTokToken, readTikTokToken } from "@/lib/integrations/tiktok/flow";
import { supabaseAdmin } from "@/lib/supabase/admin";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export function encryptTikTokSecret(plaintext: string): { ciphertext: string; nonce: string } | null {
  const encrypted = encryptIntegrationSecret(plaintext);
  if ("error" in encrypted) return null;
  return {
    ciphertext: encrypted.ciphertext.toString("base64"),
    nonce: encrypted.nonce.toString("base64"),
  };
}

export function decryptTikTokSecret(ciphertext: string, nonce: string): string | null {
  const plaintext = decryptIntegrationSecret({
    ciphertext: Buffer.from(ciphertext, "base64"),
    nonce: Buffer.from(nonce, "base64"),
    keyVersion: 1,
  });
  return typeof plaintext === "string" && plaintext.length > 0 ? plaintext : null;
}

export async function insertTikTokOAuthState(input: {
  tenantId: string;
  userId: string;
  stateHash: string;
  pkceCiphertext: string;
  pkceNonce: string;
  expiresAt: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("tiktok_oauth_state_insert", {
    p_tenant_id: input.tenantId,
    p_user_id: input.userId,
    p_state_hash: input.stateHash,
    p_pkce_ciphertext: input.pkceCiphertext,
    p_pkce_nonce: input.pkceNonce,
    p_expires_at: input.expiresAt,
  });
  if (error) {
    console.error("tiktok_oauth_state_insert_failed");
    return false;
  }
  return true;
}

export async function consumeTikTokOAuthState(stateHash: string): Promise<
  | { outcome: "ok"; tenantId: string; userId: string; pkceCiphertext: string; pkceNonce: string }
  | { outcome: "missing" | "consumed" | "expired" | "provider_mismatch" }
> {
  const { data, error } = await supabaseAdmin.rpc("tiktok_oauth_state_consume", {
    p_state_hash: stateHash,
  });
  const row = asRecord(data);
  if (error || !row) return { outcome: "missing" };
  if (row.outcome === "ok" && row.provider === "tiktok") {
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

export async function upsertTikTokConnection(input: {
  tenantId: string;
  userId: string;
  openId: string;
  displayName: string;
  scopes: string[];
  uploadConsent: boolean;
  tokenExpiresAt: string;
  accessToken: string;
  refreshToken: string;
  refreshExpiresIn: number | null;
}): Promise<boolean> {
  const encrypted = encryptTikTokSecret(encodeTikTokToken({
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    obtainedAt: new Date().toISOString(),
    refreshExpiresIn: input.refreshExpiresIn,
  }));
  if (!encrypted) return false;
  const { error } = await supabaseAdmin.rpc("tiktok_upsert_connection", {
    p_tenant_id: input.tenantId,
    p_provider_account_id: input.openId,
    p_display_name: input.displayName,
    p_status: "connected",
    p_scopes: input.scopes,
    p_upload_consent: input.uploadConsent,
    p_direct_post_consent: false,
    p_connected_by: input.userId,
    p_token_expires_at: input.tokenExpiresAt,
    p_last_error: null,
    p_ciphertext: encrypted.ciphertext,
    p_nonce: encrypted.nonce,
    p_key_version: 1,
  });
  if (error) {
    console.error("tiktok_upsert_connection_failed");
    return false;
  }
  return true;
}

export async function prepareTikTokDraft(input: {
  tenantId: string;
  userId: string;
  idempotencyKey: string;
  caption: string;
  mediaObjectPath: string;
}): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin.rpc("tiktok_publish_prepare", {
    p_tenant_id: input.tenantId,
    p_created_by: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_caption: input.caption,
    p_media_object_path: input.mediaObjectPath,
  });
  if (error) {
    console.error("tiktok_publish_prepare_failed");
    return null;
  }
  return asRecord(data);
}

export async function readTikTokDraftConnection(tenantId: string): Promise<
  | { ok: true; connectedBy: string; scopes: string[]; ciphertext: string; nonce: string }
  | { ok: false }
> {
  const { data, error } = await supabaseAdmin.rpc("tiktok_read_connection_secret", {
    p_tenant_id: tenantId,
  });
  const row = asRecord(data);
  if (error || !row || row.found !== true || typeof row.connected_by !== "string") return { ok: false };
  const scopes = Array.isArray(row.scopes) ? row.scopes.filter((scope) => typeof scope === "string") : [];
  if (typeof row.ciphertext !== "string" || typeof row.nonce !== "string") return { ok: false };
  return { ok: true, connectedBy: row.connected_by, scopes, ciphertext: row.ciphertext, nonce: row.nonce };
}

export function openTikTokDraftAccessToken(ciphertext: string, nonce: string): string | null {
  const plaintext = decryptTikTokSecret(ciphertext, nonce);
  return plaintext ? readTikTokToken(plaintext)?.accessToken ?? null : null;
}

export async function claimTikTokDraft(input: {
  tenantId: string;
  userId: string;
  idempotencyKey: string;
  caption: string;
  mediaObjectPath: string;
}): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin.rpc("tiktok_draft_claim", {
    p_tenant_id: input.tenantId,
    p_created_by: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_caption: input.caption,
    p_media_object_path: input.mediaObjectPath,
  });
  if (error) {
    console.error("tiktok_draft_claim_failed");
    return null;
  }
  return asRecord(data);
}

export async function settleTikTokDraft(input: {
  tenantId: string;
  jobId: string;
  kind: "success" | "ambiguous" | "rejected";
  publishId?: string | null;
  safeError?: string | null;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("tiktok_draft_settle", {
    p_tenant_id: input.tenantId,
    p_job_id: input.jobId,
    p_kind: input.kind,
    p_publish_id: input.publishId ?? null,
    p_safe_error: input.safeError ?? null,
  });
  if (error) {
    console.error("tiktok_draft_settle_failed");
    return false;
  }
  return true;
}

export async function insertTikTokMediaGrant(input: {
  tenantId: string;
  tokenHash: string;
  objectPath: string;
  expiresAt: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("tiktok_media_grant_insert", {
    p_tenant_id: input.tenantId,
    p_token_hash: input.tokenHash,
    p_object_path: input.objectPath,
    p_expires_at: input.expiresAt,
  });
  if (error) {
    console.error("tiktok_media_grant_insert_failed");
    return false;
  }
  return true;
}

export async function readTikTokMediaGrant(tokenHash: string): Promise<
  | { tenantId: string; objectPath: string; expiresAt: string }
  | null
> {
  const { data, error } = await supabaseAdmin.rpc("tiktok_media_grant_read", {
    p_token_hash: tokenHash,
  });
  const row = asRecord(data);
  if (error || !row || row.outcome !== "ok") return null;
  if (typeof row.tenant_id !== "string" || typeof row.object_path !== "string" || typeof row.expires_at !== "string") {
    return null;
  }
  return { tenantId: row.tenant_id, objectPath: row.object_path, expiresAt: row.expires_at };
}

export async function deleteTikTokConnection(tenantId: string): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("tiktok_disconnect", {
    p_tenant_id: tenantId,
  });
  if (error) {
    console.error("tiktok_disconnect_failed");
    return false;
  }
  return true;
}

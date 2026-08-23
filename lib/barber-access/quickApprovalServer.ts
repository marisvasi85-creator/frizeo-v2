import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createAccessRequestToken,
  hashAccessRequestToken,
  resolveQuickApprovalViewState,
  type QuickApprovalOutcome,
  type QuickApprovalViewState,
} from "./quickApprovalToken";

type DatabaseError = {
  code?: string | null;
  message?: string | null;
};

type NewAccessRequestInput = {
  tenantId: string;
  barberId: string;
  phoneNormalized: string;
  clientName: string;
  clientEmail: string | null;
  referral: string | null;
  message: string | null;
};

export type CreatedAccessRequest = {
  id: string;
  status: string;
  quickToken: string | null;
};

export type QuickApprovalView = {
  state: QuickApprovalViewState;
  requestId: string | null;
  barberId: string | null;
  barberName: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  referral: string | null;
  message: string | null;
};

let quickApprovalSchemaConfirmed = false;

export function isMissingQuickApprovalSchema(
  error: DatabaseError | null,
): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    Boolean(
      error.message?.includes("barber_access_request_tokens") ||
        error.message?.includes("access_request_sms_enabled") ||
        error.message?.includes("create_barber_access_request_with_token") ||
        error.message?.includes("accept_barber_access_request_token") ||
        error.message?.includes("claim_barber_access_approval_notification"),
    )
  );
}

export async function isQuickApprovalSchemaReady(): Promise<boolean> {
  if (quickApprovalSchemaConfirmed) return true;

  const { error } = await supabaseAdmin
    .from("barber_access_request_tokens")
    .select("request_id")
    .limit(1);

  if (isMissingQuickApprovalSchema(error)) return false;
  if (error) throw error;

  quickApprovalSchemaConfirmed = true;
  return true;
}

async function createLegacyPendingAccessRequest(
  input: NewAccessRequestInput,
): Promise<{ data: CreatedAccessRequest | null; error: DatabaseError | null }> {
  const { data, error } = await supabaseAdmin
    .from("barber_client_access")
    .insert({
      tenant_id: input.tenantId,
      barber_id: input.barberId,
      phone_normalized: input.phoneNormalized,
      client_name: input.clientName,
      client_email: input.clientEmail,
      referral: input.referral,
      request_message: input.message,
      status: "pending",
      source: "client_request",
      requested_at: new Date().toISOString(),
    })
    .select("id, status")
    .single();

  return {
    data: data ? { id: data.id, status: data.status, quickToken: null } : null,
    error,
  };
}

export async function createPendingAccessRequest(
  input: NewAccessRequestInput,
): Promise<{
  data: CreatedAccessRequest | null;
  error: DatabaseError | null;
  quickApprovalReady: boolean;
}> {
  const quickApprovalReady = await isQuickApprovalSchemaReady();
  if (!quickApprovalReady) {
    const legacy = await createLegacyPendingAccessRequest(input);
    return { ...legacy, quickApprovalReady: false };
  }

  const token = createAccessRequestToken();
  const { data, error } = await supabaseAdmin.rpc(
    "create_barber_access_request_with_token",
    {
      p_tenant_id: input.tenantId,
      p_barber_id: input.barberId,
      p_phone_normalized: input.phoneNormalized,
      p_client_name: input.clientName,
      p_client_email: input.clientEmail,
      p_referral: input.referral,
      p_request_message: input.message,
      p_token_hash: token.tokenHash,
      p_expires_at: token.expiresAt,
    },
  );

  const row = Array.isArray(data) ? data[0] : data;
  return {
    data: row?.request_id
      ? {
          id: row.request_id,
          status: row.request_status,
          quickToken: token.token,
        }
      : null,
    error,
    quickApprovalReady: true,
  };
}

function unavailableQuickApprovalView(): QuickApprovalView {
  return {
    state: "unavailable",
    requestId: null,
    barberId: null,
    barberName: null,
    clientName: null,
    clientPhone: null,
    clientEmail: null,
    referral: null,
    message: null,
  };
}

export async function getQuickApprovalView(
  rawToken: string,
): Promise<QuickApprovalView> {
  const tokenHash = hashAccessRequestToken(rawToken);
  if (!tokenHash || !(await isQuickApprovalSchemaReady())) {
    return unavailableQuickApprovalView();
  }

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("barber_access_request_tokens")
    .select("request_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) return unavailableQuickApprovalView();

  const { data: access, error: accessError } = await supabaseAdmin
    .from("barber_client_access")
    .select(
      "id, barber_id, status, client_name, phone_normalized, client_email, referral, request_message",
    )
    .eq("id", tokenRow.request_id)
    .maybeSingle();

  if (accessError || !access) return unavailableQuickApprovalView();

  const state = resolveQuickApprovalViewState({
    status: access.status,
    expiresAt: tokenRow.expires_at,
    usedAt: tokenRow.used_at,
  });
  if (state === "unavailable") return unavailableQuickApprovalView();

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("display_name")
    .eq("id", access.barber_id)
    .maybeSingle();
  const exposeDetails = state === "pending";

  return {
    state,
    requestId: access.id,
    barberId: access.barber_id,
    barberName: barber?.display_name ?? null,
    clientName: exposeDetails ? access.client_name : null,
    clientPhone: exposeDetails ? access.phone_normalized : null,
    clientEmail: exposeDetails ? access.client_email : null,
    referral: exposeDetails ? access.referral : null,
    message: exposeDetails ? access.request_message : null,
  };
}

export async function acceptQuickApprovalToken(
  rawToken: string,
): Promise<{
  outcome: QuickApprovalOutcome;
  requestId: string | null;
  barberId: string | null;
}> {
  const tokenHash = hashAccessRequestToken(rawToken);
  if (!tokenHash || !(await isQuickApprovalSchemaReady())) {
    return { outcome: "invalid", requestId: null, barberId: null };
  }

  const { data, error } = await supabaseAdmin.rpc(
    "accept_barber_access_request_token",
    { p_token_hash: tokenHash },
  );
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const outcome = row?.outcome as QuickApprovalOutcome | undefined;
  if (
    !outcome ||
    !["approved", "already_approved", "rejected", "blocked", "expired", "invalid"].includes(
      outcome,
    )
  ) {
    return { outcome: "invalid", requestId: null, barberId: null };
  }

  return {
    outcome,
    requestId: row?.request_id ?? null,
    barberId: row?.barber_id ?? null,
  };
}

export async function markAccessRequestTokensProcessed(
  requestIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(requestIds)].filter(Boolean);
  if (uniqueIds.length === 0 || !(await isQuickApprovalSchemaReady())) return;

  const { error } = await supabaseAdmin
    .from("barber_access_request_tokens")
    .update({ used_at: new Date().toISOString() })
    .in("request_id", uniqueIds)
    .is("used_at", null);

  if (error) throw error;
}

export async function claimApprovalNotification(requestId: string): Promise<{
  requestId: string;
  barberId: string;
  clientName: string;
  clientEmail: string | null;
} | null> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_barber_access_approval_notification",
    { p_request_id: requestId },
  );

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.request_id) return null;

  return {
    requestId: row.request_id,
    barberId: row.barber_id,
    clientName: row.client_name || "Client",
    clientEmail: row.client_email ?? null,
  };
}

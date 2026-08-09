import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmailAppUrl } from "@/lib/frizeo-email/config";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function buildUnsubscribeUrl(
  rawToken: string,
  emailAppUrl = getEmailAppUrl(),
): string {
  return `${emailAppUrl.replace(/\/$/, "")}/unsubscribe/${encodeURIComponent(rawToken)}`;
}

/** Create (or reuse) an active unsubscribe token; returns the raw token once. */
export async function ensureUnsubscribeToken(
  contactId: string,
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("marketing_unsubscribe_tokens")
    .select("id, token_hash")
    .eq("contact_id", contactId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Existing hashes can't be reversed — always mint a fresh token for new links.
  // Keep old tokens valid until revoked so previously sent emails still work.
  void existing;

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);

  const { error } = await supabaseAdmin
    .from("marketing_unsubscribe_tokens")
    .insert({
      contact_id: contactId,
      token_hash: tokenHash,
    });

  if (error) {
    throw new Error(error.message);
  }

  return rawToken;
}

export type UnsubscribeResult =
  | {
      ok: true;
      alreadyUnsubscribed: boolean;
      emailMasked: string;
    }
  | { ok: false; error: "invalid_token" | "db" };

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export async function unsubscribeByToken(
  rawToken: string,
  meta?: { ip?: string | null; userAgent?: string | null },
): Promise<UnsubscribeResult> {
  const token = rawToken?.trim();
  if (!token || token.length < 16) {
    return { ok: false, error: "invalid_token" };
  }

  const tokenHash = hashToken(token);

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("marketing_unsubscribe_tokens")
    .select("id, contact_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError) return { ok: false, error: "db" };
  if (!tokenRow || tokenRow.revoked_at) {
    return { ok: false, error: "invalid_token" };
  }

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("marketing_contacts")
    .select("id, email, status, unsubscribed_at")
    .eq("id", tokenRow.contact_id)
    .maybeSingle();

  if (contactError || !contact) return { ok: false, error: "db" };

  const alreadyUnsubscribed =
    contact.status === "unsubscribed" || contact.unsubscribed_at != null;

  const now = new Date().toISOString();

  if (!alreadyUnsubscribed) {
    const { error: updateError } = await supabaseAdmin
      .from("marketing_contacts")
      .update({
        status: "unsubscribed",
        marketing_consent: false,
        unsubscribed_at: now,
      })
      .eq("id", contact.id);

    if (updateError) return { ok: false, error: "db" };
  }

  await supabaseAdmin
    .from("marketing_unsubscribe_tokens")
    .update({ used_at: now })
    .eq("id", tokenRow.id)
    .is("used_at", null);

  const ipHash = meta?.ip
    ? createHash("sha256").update(meta.ip).digest("hex")
    : null;

  const { data: unsubscribeEvent, error: unsubscribeEventError } =
    await supabaseAdmin
      .from("marketing_unsubscribe_events")
      .insert({
        contact_id: contact.id,
        token_id: tokenRow.id,
        ip_hash: ipHash,
        user_agent: meta?.userAgent?.slice(0, 500) || null,
      })
      .select("id")
      .single();

  if (unsubscribeEventError || !unsubscribeEvent) {
    console.error("[marketing-unsubscribe] audit event failed", {
      contactId: contact.id,
      message: unsubscribeEventError?.message || "Missing audit event id",
    });
  } else {
    const { error: analyticsError } = await supabaseAdmin.rpc(
      "record_marketing_unsubscribe_analytics",
      {
        p_unsubscribe_event_id: unsubscribeEvent.id,
        p_unsubscribe_token: token,
        p_event_timestamp: now,
      },
    );
    if (analyticsError) {
      // Unsubscribe already succeeded; analytics must never undo that action.
      console.error("[marketing-unsubscribe] campaign analytics failed", {
        contactId: contact.id,
        unsubscribeEventId: unsubscribeEvent.id,
        message: analyticsError.message,
      });
    }
  }

  return {
    ok: true,
    alreadyUnsubscribed,
    emailMasked: maskEmail(contact.email),
  };
}

import { createHash } from "node:crypto";
import { isValidEmail, normalizeEmail } from "@/lib/auth/credentials";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  ContactListFilters,
  MarketingContact,
  MarketingContactSource,
  MarketingContactStatus,
} from "@/lib/frizeo-email/types";
import { ensureUnsubscribeToken } from "@/lib/frizeo-email/unsubscribe";

export type CreateContactInput = {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  source?: MarketingContactSource;
  marketing_consent?: boolean;
  consent_source?: string | null;
  user_id?: string | null;
  tenant_id?: string | null;
  notes?: string | null;
};

export type DashboardContactStats = {
  total: number;
  subscribed: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
  withConsent: number;
};

function splitName(fullName: string | null | undefined): {
  first_name: string | null;
  last_name: string | null;
} {
  const trimmed = fullName?.trim() || "";
  if (!trimmed) return { first_name: null, last_name: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

function deletedEmailHash(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

export async function getContactStats(): Promise<DashboardContactStats> {
  const { data, error } = await supabaseAdmin
    .from("marketing_contacts")
    .select("status, marketing_consent")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const stats: DashboardContactStats = {
    total: rows.length,
    subscribed: 0,
    unsubscribed: 0,
    bounced: 0,
    complained: 0,
    withConsent: 0,
  };

  for (const row of rows) {
    if (row.status === "subscribed" && row.marketing_consent) {
      stats.subscribed += 1;
    }
    if (row.status === "unsubscribed") stats.unsubscribed += 1;
    if (row.status === "bounced") stats.bounced += 1;
    if (row.status === "complained") stats.complained += 1;
    if (row.marketing_consent) stats.withConsent += 1;
  }

  return stats;
}

export async function listContacts(
  filters: ContactListFilters = {},
  options: { limit?: number; offset?: number } = {},
): Promise<{ contacts: MarketingContact[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = supabaseAdmin
    .from("marketing_contacts")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }
  if (filters.consent === "yes") {
    query = query.eq("marketing_consent", true);
  } else if (filters.consent === "no") {
    query = query.eq("marketing_consent", false);
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim().replace(/[%_,]/g, " ");
    query = query.or(
      `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    contacts: (data ?? []) as MarketingContact[],
    total: count ?? 0,
  };
}

export async function createContact(
  input: CreateContactInput,
): Promise<
  | { ok: true; contact: MarketingContact; created: boolean }
  | { ok: false; error: string; code: "invalid_email" | "duplicate" | "db" }
> {
  if (!isValidEmail(input.email || "")) {
    return { ok: false, error: "Email invalid.", code: "invalid_email" };
  }

  const email = normalizeEmail(input.email);
  const marketingConsent = Boolean(input.marketing_consent);
  const now = new Date().toISOString();

  const payload = {
    email,
    first_name: input.first_name?.trim() || null,
    last_name: input.last_name?.trim() || null,
    phone: input.phone?.trim() || null,
    source: input.source ?? "manual",
    status: "subscribed" as MarketingContactStatus,
    marketing_consent: marketingConsent,
    consent_source: marketingConsent
      ? input.consent_source?.trim() || input.source || "manual"
      : null,
    consent_at: marketingConsent ? now : null,
    user_id: input.user_id ?? null,
    tenant_id: input.tenant_id ?? null,
    notes: input.notes?.trim() || null,
  };

  const { data: existing } = await supabaseAdmin
    .from("marketing_contacts")
    .select("*")
    .eq("email_normalized", email)
    .maybeSingle();

  const { data: deletedContact } = await supabaseAdmin
    .from("marketing_contacts")
    .select("id")
    .eq("deleted_email_hash", deletedEmailHash(email))
    .maybeSingle();

  if (existing || deletedContact) {
    return {
      ok: false,
      error: "Există deja un contact cu acest email.",
      code: "duplicate",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("marketing_contacts")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return {
        ok: false,
        error: "Există deja un contact cu acest email.",
        code: "duplicate",
      };
    }
    return {
      ok: false,
      error: error?.message || "Nu am putut salva contactul.",
      code: "db",
    };
  }

  await ensureUnsubscribeToken(data.id);

  return { ok: true, contact: data as MarketingContact, created: true };
}

/**
 * CSV / sync upsert rules:
 * - email match is case-insensitive
 * - never revive an unsubscribed/bounced/complained contact to subscribed
 * - never clear marketing_consent once true unless already unsubscribed flow
 * - fill empty name/phone; do not overwrite non-empty fields
 */
export async function upsertContactSoft(
  input: CreateContactInput,
): Promise<"imported" | "duplicate" | "invalid"> {
  if (!isValidEmail(input.email || "")) return "invalid";

  const email = normalizeEmail(input.email);
  const { data: existing } = await supabaseAdmin
    .from("marketing_contacts")
    .select("*")
    .eq("email_normalized", email)
    .maybeSingle();

  const { data: deletedContact } = await supabaseAdmin
    .from("marketing_contacts")
    .select("id")
    .eq("deleted_email_hash", deletedEmailHash(email))
    .maybeSingle();

  if (deletedContact) return "duplicate";

  if (!existing) {
    const created = await createContact(input);
    return created.ok ? "imported" : created.code === "invalid_email" ? "invalid" : "duplicate";
  }

  const patch: Record<string, unknown> = {};
  if (!existing.first_name && input.first_name?.trim()) {
    patch.first_name = input.first_name.trim();
  }
  if (!existing.last_name && input.last_name?.trim()) {
    patch.last_name = input.last_name.trim();
  }
  if (!existing.phone && input.phone?.trim()) {
    patch.phone = input.phone.trim();
  }
  if (!existing.user_id && input.user_id) patch.user_id = input.user_id;
  if (!existing.tenant_id && input.tenant_id) patch.tenant_id = input.tenant_id;

  // Only grant consent if explicitly provided and contact is still subscribed.
  if (
    input.marketing_consent &&
    !existing.marketing_consent &&
    existing.status === "subscribed" &&
    !existing.unsubscribed_at
  ) {
    patch.marketing_consent = true;
    patch.consent_source =
      input.consent_source?.trim() || input.source || "import";
    patch.consent_at = new Date().toISOString();
  }

  if (Object.keys(patch).length > 0) {
    await supabaseAdmin
      .from("marketing_contacts")
      .update(patch)
      .eq("id", existing.id);
  }

  return "duplicate";
}

/** Import Frizeo tenant owners as contacts WITHOUT marketing consent. */
export async function syncFrizeoOwnerContacts(): Promise<{
  imported: number;
  duplicate: number;
  invalid: number;
}> {
  const result = { imported: 0, duplicate: 0, invalid: 0 };

  const { data: owners, error } = await supabaseAdmin
    .from("tenant_users")
    .select("user_id, tenant_id, role")
    .eq("role", "owner");

  if (error) throw new Error(error.message);
  if (!owners?.length) return result;

  const userIds = [...new Set(owners.map((o) => o.user_id).filter(Boolean))];

  for (const userId of userIds) {
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !authData.user?.email) {
      result.invalid += 1;
      continue;
    }

    const membership = owners.find((o) => o.user_id === userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    const names = splitName(profile?.full_name);
    const outcome = await upsertContactSoft({
      email: authData.user.email,
      first_name: names.first_name,
      last_name: names.last_name,
      phone: profile?.phone ?? null,
      source: "frizeo_user",
      marketing_consent: false,
      user_id: userId,
      tenant_id: membership?.tenant_id ?? null,
    });

    result[outcome] += 1;
  }

  return result;
}

export function canReceiveMarketing(contact: {
  status: string;
  marketing_consent: boolean;
  unsubscribed_at: string | null;
  deleted_at?: string | null;
}): boolean {
  return (
    contact.status === "subscribed" &&
    contact.marketing_consent === true &&
    contact.unsubscribed_at == null &&
    contact.deleted_at == null
  );
}

export async function deleteMarketingContacts(
  contactIds: string[],
  deletedBy: string,
): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("delete_marketing_contacts", {
    p_contact_ids: contactIds,
    p_deleted_by: deletedBy,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

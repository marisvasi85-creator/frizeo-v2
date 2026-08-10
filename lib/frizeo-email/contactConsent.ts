import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const MAX_CONSENT_BULK_CONTACTS = 200;

export const CONTACT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ConsentChangeResult =
  | "changed"
  | "unchanged"
  | "blocked_unsubscribe_history"
  | "blocked_suppressed_status";

export type ConsentChangeRow = {
  changed_contact_id: string;
  result: ConsentChangeResult;
  current_marketing_consent: boolean;
};

export async function setMarketingContactConsent(input: {
  contactIds: string[];
  marketingConsent: boolean;
  actionSource: "manual_admin" | "bulk_admin";
  changedBy: string;
}): Promise<ConsentChangeRow[]> {
  const { data: activeContacts, error: lookupError } = await supabaseAdmin
    .from("marketing_contacts")
    .select("id")
    .in("id", input.contactIds)
    .is("deleted_at", null);
  if (lookupError) throw new Error(lookupError.message);
  const activeIds = (activeContacts ?? []).map((contact) => contact.id);
  if (activeIds.length === 0) return [];

  const { data, error } = await supabaseAdmin.rpc(
    "set_marketing_contact_consent",
    {
      p_contact_ids: activeIds,
      p_marketing_consent: input.marketingConsent,
      p_action_source: input.actionSource,
      p_changed_by: input.changedBy,
    },
  );

  if (error) throw new Error(error.message);
  return (data ?? []) as ConsentChangeRow[];
}

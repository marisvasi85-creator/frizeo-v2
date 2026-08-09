export const MARKETING_CONTACT_SOURCES = [
  "frizeo_user",
  "external_lead",
  "csv",
  "manual",
] as const;

export type MarketingContactSource = (typeof MARKETING_CONTACT_SOURCES)[number];

export const MARKETING_CONTACT_STATUSES = [
  "subscribed",
  "unsubscribed",
  "bounced",
  "complained",
] as const;

export type MarketingContactStatus = (typeof MARKETING_CONTACT_STATUSES)[number];

export type MarketingContact = {
  id: string;
  email: string;
  email_normalized?: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  source: MarketingContactSource;
  status: MarketingContactStatus;
  marketing_consent: boolean;
  consent_source: string | null;
  consent_at: string | null;
  unsubscribed_at: string | null;
  user_id: string | null;
  tenant_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactListFilters = {
  q?: string;
  status?: MarketingContactStatus | "all";
  source?: MarketingContactSource | "all";
  consent?: "all" | "yes" | "no";
};

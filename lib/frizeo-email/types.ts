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

export const MARKETING_AUDIENCE_KINDS = [
  "all_subscribed",
  "leads",
  "registered_users",
  "controlled_test",
] as const;

export type MarketingAudienceKind =
  (typeof MARKETING_AUDIENCE_KINDS)[number];

export const MARKETING_CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "queued",
  "sending",
  "sent",
  "partially_failed",
  "failed",
  "cancelled",
] as const;

export type MarketingCampaignStatus =
  (typeof MARKETING_CAMPAIGN_STATUSES)[number];

export const MARKETING_RECIPIENT_STATUSES = [
  "pending",
  "queued",
  "sending",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "unsubscribed",
  "failed",
  "skipped",
] as const;

export type MarketingRecipientStatus =
  (typeof MARKETING_RECIPIENT_STATUSES)[number];

export type MarketingEmailContent = {
  subject: string;
  preview_text: string;
  heading: string;
  body_text: string;
  image_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  footer_text: string;
};

export type MarketingEmailTemplate = MarketingEmailContent & {
  id: string;
  name: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingCampaign = MarketingEmailContent & {
  id: string;
  name: string;
  sender_name: string;
  sender_email: string;
  reply_to: string | null;
  template_id: string | null;
  audience_kind: MarketingAudienceKind;
  test_contact_ids: string[];
  status: MarketingCampaignStatus;
  recipient_count: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  failed_count: number;
  audience_snapshot_at: string | null;
  scheduled_at: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingCampaignRecipient = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  email: string;
  email_normalized?: string;
  first_name: string | null;
  last_name: string | null;
  status: MarketingRecipientStatus;
  provider: string | null;
  provider_message_id: string | null;
  queued_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  attempt_count: number;
  first_attempt_at: string | null;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingAudienceSummary = {
  kind: MarketingAudienceKind;
  label: string;
  description: string;
  count: number;
};

export type MarketingTestContactOption = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export type MarketingCampaignProgress = {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  skipped: number;
};

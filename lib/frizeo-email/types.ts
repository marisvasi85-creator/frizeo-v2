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
  bounced_at: string | null;
  complained_at: string | null;
  suppression_reason: string | null;
  user_id: string | null;
  tenant_id: string | null;
  notes: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_email_hash?: string | null;
  created_at: string;
  updated_at: string;
};

export const MARKETING_CTA_URL_TYPES = [
  "custom",
  "register",
  "marketing",
  "dashboard",
  "booking_link",
  "plans",
] as const;

export type MarketingCtaUrlType = (typeof MARKETING_CTA_URL_TYPES)[number];

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
  "segment",
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
  template_key: string | null;
  category: string | null;
  recommended_audience: string | null;
  automation_key: string | null;
  cta_url_type: MarketingCtaUrlType;
  is_system_template: boolean;
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
  cta_url_type: MarketingCtaUrlType;
  audience_kind: MarketingAudienceKind;
  segment_id: string | null;
  segment_key_snapshot: string | null;
  segment_name_snapshot: string | null;
  segment_definition_snapshot: MarketingSegmentDefinition | null;
  test_contact_ids: string[];
  status: MarketingCampaignStatus;
  recipient_count: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  complained_count: number;
  unsubscribed_count: number;
  failed_count: number;
  audience_snapshot_at: string | null;
  scheduled_at: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  sent_at: string | null;
  created_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
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
  first_opened_at: string | null;
  last_opened_at: string | null;
  first_clicked_at: string | null;
  last_clicked_at: string | null;
  delivery_delayed_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  unsubscribed_at: string | null;
  bounce_type: string | null;
  bounce_subtype: string | null;
  bounce_reason: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
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

export const MARKETING_SEGMENT_FIELDS = [
  "source",
  "contact_status",
  "account_status",
  "subscription_plan",
  "subscription_status",
  "trial_status",
  "trial_end_date",
  "bookings_count",
  "bookings_count_bucket",
  "created_at",
  "last_activity",
  "activity_status",
  "consent_status",
  "is_paid",
] as const;

export type MarketingSegmentField = (typeof MARKETING_SEGMENT_FIELDS)[number];

export const MARKETING_SEGMENT_OPERATORS = [
  "equals",
  "not_equals",
  "in",
  "greater_than",
  "less_than",
  "before",
  "after",
  "yes",
  "no",
] as const;

export type MarketingSegmentOperator =
  (typeof MARKETING_SEGMENT_OPERATORS)[number];

export type MarketingSegmentCondition = {
  field: MarketingSegmentField;
  operator: MarketingSegmentOperator;
  value?: string | string[] | number;
};

export type MarketingSegmentDefinition = {
  version: 1;
  logic: "AND";
  conditions: MarketingSegmentCondition[];
};

export type MarketingSegment = {
  id: string;
  segment_key: string | null;
  name: string;
  description: string;
  category: string;
  definition: MarketingSegmentDefinition;
  is_system_segment: boolean;
  created_by: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingSegmentSummary = MarketingSegment & {
  contacts_count: number;
  evaluated_at: string;
};

export type MarketingSegmentMember = {
  contact_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  source: string;
  contact_status: string;
  account_status: string;
  subscription_plan: string;
  subscription_status: string;
  is_paid: boolean;
  trial_status: string;
  trial_end_date: string | null;
  bookings_count: number;
  bookings_count_bucket: string;
  created_at: string;
  last_activity: string | null;
  activity_status: string;
  consent_status: boolean;
  total_count: number;
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
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  failed: number;
  skipped: number;
};

export const MARKETING_AUTOMATION_TRIGGER_TYPES = [
  "user_signed_up",
  "trial_started",
  "trial_ending_7_days",
  "trial_ending_3_days",
  "trial_last_day",
  "trial_expired",
  "subscription_activated",
] as const;

export type MarketingAutomationTriggerType =
  (typeof MARKETING_AUTOMATION_TRIGGER_TYPES)[number];

export const MARKETING_AUTOMATION_RUN_STATUSES = [
  "pending",
  "scheduled",
  "processing",
  "sent",
  "skipped",
  "failed",
  "cancelled",
] as const;

export type MarketingAutomationRunStatus =
  (typeof MARKETING_AUTOMATION_RUN_STATUSES)[number];

export type MarketingAutomation = {
  id: string;
  automation_key: string;
  name: string;
  description: string;
  trigger_type: MarketingAutomationTriggerType;
  delay_minutes: number;
  template_id: string;
  conditions: Record<string, unknown>;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MarketingAutomationSummary = MarketingAutomation & {
  template_name: string | null;
  template_key: string | null;
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  last_run_at: string | null;
};

export type MarketingAutomationRun = {
  id: string;
  automation_id: string;
  contact_id: string;
  user_id: string | null;
  tenant_id: string | null;
  trigger_key: string;
  trigger_reference: string;
  status: MarketingAutomationRunStatus;
  scheduled_for: string;
  started_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  attempt_count: number;
  next_attempt_at: string | null;
  provider: string | null;
  provider_message_id: string | null;
  skip_reason: string | null;
  last_error: string | null;
  is_test: boolean;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
  contact_email?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
};

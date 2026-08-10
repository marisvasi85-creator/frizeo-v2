import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmailTemplate, listEmailTemplates } from "@/lib/frizeo-email/templates";
import { getFrizeoAppUrl } from "@/lib/frizeo-email/config";
import { marketingCtaUrl } from "@/lib/frizeo-email/templateVariables";
import {
  getMarketingSegment,
  listMarketingSegments,
  previewMarketingSegment,
} from "@/lib/frizeo-email/segments";
import type {
  MarketingAudienceKind,
  MarketingAudienceSummary,
  MarketingCampaign,
  MarketingCampaignProgress,
  MarketingCampaignRecipient,
  MarketingEmailContent,
  MarketingTestContactOption,
} from "@/lib/frizeo-email/types";

export type CreateCampaignInput = {
  name: string;
  templateId?: string | null;
  blank?: boolean;
  segmentId?: string | null;
};

export type UpdateCampaignInput = MarketingEmailContent & {
  name: string;
  sender_name: string;
  sender_email: string;
  reply_to: string | null;
  template_id: string | null;
  audience_kind: MarketingAudienceKind;
  segment_id: string | null;
  test_contact_ids: string[];
};

export type ClaimedMarketingRecipient = MarketingEmailContent & {
  recipient_id: string;
  campaign_id: string;
  contact_id: string | null;
  recipient_email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribe_token: string | null;
  attempt_count: number;
  claim_token: string;
};

export function getMarketingSenderDefaults() {
  return {
    senderName: "Frizeo",
    senderEmail: "",
    replyTo: null,
  };
}

export async function listCampaigns(limit = 100): Promise<MarketingCampaign[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingCampaign[];
}

export async function getCampaign(id: string): Promise<MarketingCampaign | null> {
  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as MarketingCampaign | null) ?? null;
}

export async function createCampaign(
  input: CreateCampaignInput,
  createdBy: string,
): Promise<MarketingCampaign> {
  let template = input.templateId
    ? await getEmailTemplate(input.templateId)
    : null;

  if (input.templateId && !template) {
    throw new Error("Template-ul selectat nu există.");
  }

  if (!template && !input.blank) {
    const templates = await listEmailTemplates();
    template = templates.find((item) => item.is_default) ?? templates[0] ?? null;
  }

  const sender = getMarketingSenderDefaults();
  const appUrl = getFrizeoAppUrl();
  const ctaUrl = template
    ? marketingCtaUrl(template.cta_url_type, appUrl) ?? template.cta_url
    : null;
  const selectedSegment = input.segmentId
    ? await getMarketingSegment(input.segmentId)
    : null;
  if (input.segmentId && !selectedSegment) {
    throw new Error("Segmentul selectat nu există.");
  }
  const audienceKind: MarketingAudienceKind = selectedSegment
    ? "segment"
    : "all_subscribed";
  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .insert({
      name: input.name,
      subject: template?.subject ?? "",
      preview_text: template?.preview_text ?? "",
      sender_name: sender.senderName,
      sender_email: sender.senderEmail,
      reply_to: sender.replyTo,
      template_id: template?.id ?? null,
      heading: template?.heading ?? "",
      body_text: template?.body_text ?? "",
      image_url: template?.image_url ?? null,
      cta_text: template?.cta_text ?? null,
      cta_url: ctaUrl,
      cta_url_type: template?.cta_url_type ?? "custom",
      footer_text:
        template?.footer_text ??
        "Frizeo · Programări online pentru frizeri și saloane.",
      audience_kind: audienceKind,
      segment_id: selectedSegment?.id ?? null,
      test_contact_ids: [],
      status: "draft",
      created_by: createdBy,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Nu am putut crea campania.");
  }

  return data as MarketingCampaign;
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
): Promise<MarketingCampaign | null> {
  const current = await getCampaign(id);
  if (!current) return null;
  if (current.status !== "draft") {
    throw new Error("Doar campaniile draft pot fi editate.");
  }
  if (input.audience_kind === "segment") {
    if (!input.segment_id || !(await getMarketingSegment(input.segment_id))) {
      throw new Error("Alege un segment dinamic valid.");
    }
  }

  const currentTestContactIds = [...(current.test_contact_ids || [])].sort();
  const nextTestContactIds = [...input.test_contact_ids].sort();
  const audienceChanged =
    current.audience_kind !== input.audience_kind ||
    current.segment_id !== input.segment_id ||
    currentTestContactIds.join(",") !== nextTestContactIds.join(",");
  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .update({
      ...input,
      segment_id: input.audience_kind === "segment" ? input.segment_id : null,
      ...(audienceChanged
        ? {
            recipient_count: 0,
            audience_snapshot_at: null,
            segment_key_snapshot: null,
            segment_name_snapshot: null,
            segment_definition_snapshot: null,
          }
        : {}),
    })
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    throw new Error("Doar campaniile draft pot fi editate.");
  }

  return (data as MarketingCampaign | null) ?? null;
}

export async function deleteCampaign(
  id: string,
  deletedBy: string,
): Promise<"deleted" | "archived" | "not_found" | "active_protected"> {
  const { data, error } = await supabaseAdmin.rpc("delete_marketing_campaign", {
    p_campaign_id: id,
    p_deleted_by: deletedBy,
  });
  if (error) throw new Error(error.message);
  return String(data) as
    | "deleted"
    | "archived"
    | "not_found"
    | "active_protected";
}

export async function duplicateCampaign(
  id: string,
  createdBy: string,
): Promise<MarketingCampaign | null> {
  const source = await getCampaign(id);
  if (!source) return null;
  const copyName = `${source.name} — copie`.slice(0, 160);
  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .insert({
      name: copyName,
      subject: source.subject,
      preview_text: source.preview_text,
      sender_name: source.sender_name,
      sender_email: source.sender_email,
      reply_to: source.reply_to,
      template_id: source.template_id,
      heading: source.heading,
      body_text: source.body_text,
      image_url: source.image_url,
      cta_text: source.cta_text,
      cta_url: source.cta_url,
      cta_url_type: source.cta_url_type,
      footer_text: source.footer_text,
      audience_kind:
        source.audience_kind === "segment" && !source.segment_id
          ? "all_subscribed"
          : source.audience_kind,
      segment_id:
        source.audience_kind === "segment" ? source.segment_id : null,
      test_contact_ids: source.test_contact_ids,
      status: "draft",
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message || "Nu am putut duplica campania.");
  }
  return data as MarketingCampaign;
}

export async function getAudienceSummaries(): Promise<
  MarketingAudienceSummary[]
> {
  const [all, segments] = await Promise.all([
    previewMarketingSegment(
      {
        version: 1,
        logic: "AND",
        conditions: [{ field: "consent_status", operator: "yes" }],
      },
      1,
    ),
    listMarketingSegments(),
  ]);
  const countFor = (key: string) =>
    segments.find((segment) => segment.segment_key === key)?.contacts_count ?? 0;

  return [
    {
      kind: "all_subscribed",
      label: "Toate contactele eligibile",
      description: "Subscribed + consimțământ, fără dezabonare.",
      count: all.total,
    },
    {
      kind: "leads",
      label: "Lead-uri",
      description: "Contacte eligibile fără cont Frizeo.",
      count: countFor("leads"),
    },
    {
      kind: "registered_users",
      label: "Utilizatori înregistrați",
      description: "Contacte eligibile asociate unui cont Frizeo.",
      count: countFor("registered_users"),
    },
    {
      kind: "controlled_test",
      label: "Test controlat",
      description: "Selectează manual maximum 5 contacte eligibile.",
      count: all.total,
    },
  ];
}

export async function listEligibleTestContacts(
  limit = 100,
): Promise<MarketingTestContactOption[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const preview = await previewMarketingSegment(
    {
      version: 1,
      logic: "AND",
      conditions: [{ field: "consent_status", operator: "yes" }],
    },
    safeLimit,
  );
  return preview.members.map((member) => ({
    id: member.contact_id,
    email: member.email,
    first_name: member.first_name,
    last_name: member.last_name,
  }));
}

export async function snapshotCampaignAudience(id: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc(
    "snapshot_marketing_campaign_audience",
    { p_campaign_id: id },
  );

  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : Number(data ?? 0);
}

export async function listCampaignRecipients(
  campaignId: string,
  limit = 500,
): Promise<MarketingCampaignRecipient[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 1_000);
  const { data, error } = await supabaseAdmin
    .from("marketing_campaign_recipients")
    .select(
      "id, campaign_id, contact_id, email, email_normalized, first_name, last_name, status, provider, provider_message_id, queued_at, sent_at, delivered_at, opened_at, clicked_at, first_opened_at, last_opened_at, first_clicked_at, last_clicked_at, delivery_delayed_at, bounced_at, complained_at, unsubscribed_at, bounce_type, bounce_subtype, bounce_reason, last_event_type, last_event_at, failed_at, error_message, attempt_count, first_attempt_at, last_attempt_at, next_attempt_at, claimed_at, created_at, updated_at",
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingCampaignRecipient[];
}

export async function queueCampaign(id: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("queue_marketing_campaign", {
    p_campaign_id: id,
  });

  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : Number(data ?? 0);
}

export async function cancelCampaign(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "cancel_marketing_campaign",
    { p_campaign_id: id },
  );

  if (error) throw new Error(error.message);
  return data === true;
}

export async function claimMarketingRecipientBatch(input: {
  batchSize: number;
  leaseSeconds: number;
  maxAttempts: number;
}): Promise<ClaimedMarketingRecipient[]> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_marketing_recipient_batch",
    {
      p_batch_size: input.batchSize,
      p_lease_seconds: input.leaseSeconds,
      p_max_attempts: input.maxAttempts,
    },
  );

  if (error) throw new Error(error.message);
  return (data ?? []) as ClaimedMarketingRecipient[];
}

export async function recordMarketingRecipientResult(input: {
  recipientId: string;
  claimToken: string;
  success: boolean;
  providerMessageId?: string | null;
  temporary?: boolean;
  errorMessage?: string | null;
  retryDelaySeconds?: number;
  maxAttempts: number;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "record_marketing_recipient_result",
    {
      p_recipient_id: input.recipientId,
      p_claim_token: input.claimToken,
      p_success: input.success,
      p_provider_message_id: input.providerMessageId ?? null,
      p_temporary: input.temporary ?? false,
      p_error_message: input.errorMessage ?? null,
      p_retry_delay_seconds: input.retryDelaySeconds ?? 60,
      p_max_attempts: input.maxAttempts,
    },
  );

  if (error) throw new Error(error.message);
  return data === true;
}

export async function getCampaignProgress(
  campaignId: string,
): Promise<MarketingCampaignProgress> {
  const countStatuses = (statuses: string[]) =>
    supabaseAdmin
      .from("marketing_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", statuses);

  const [campaignResult, pending, sending, failed, skipped] = await Promise.all([
    supabaseAdmin
      .from("marketing_campaigns")
      .select(
        "recipient_count, sent_count, delivered_count, opened_count, clicked_count, bounced_count, complained_count, unsubscribed_count, failed_count",
      )
      .eq("id", campaignId)
      .maybeSingle(),
    countStatuses(["pending", "queued"]),
    countStatuses(["sending"]),
    countStatuses(["failed"]),
    countStatuses(["skipped"]),
  ]);

  const error =
    campaignResult.error ||
    pending.error ||
    sending.error ||
    failed.error ||
    skipped.error;
  if (error) throw new Error(error.message);

  const campaign = campaignResult.data;
  if (!campaign) {
    return {
      total: 0,
      pending: 0,
      sending: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      failed: 0,
      skipped: 0,
    };
  }

  return {
    total: Number(campaign.recipient_count || 0),
    pending: pending.count ?? 0,
    sending: sending.count ?? 0,
    sent: Number(campaign.sent_count || 0),
    delivered: Number(campaign.delivered_count || 0),
    opened: Number(campaign.opened_count || 0),
    clicked: Number(campaign.clicked_count || 0),
    bounced: Number(campaign.bounced_count || 0),
    complained: Number(campaign.complained_count || 0),
    unsubscribed: Number(campaign.unsubscribed_count || 0),
    failed: failed.count ?? Number(campaign.failed_count || 0),
    skipped: skipped.count ?? 0,
  };
}

export async function getCampaignDashboardData(): Promise<{
  emailsSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  campaignsSent: number;
  recent: MarketingCampaign[];
}> {
  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) throw new Error(error.message);
  const recent = (data ?? []) as MarketingCampaign[];

  const { data: sentRows, error: sentError } = await supabaseAdmin
    .from("marketing_campaigns")
    .select("sent_count, delivered_count, opened_count, clicked_count, bounced_count")
    .in("status", ["sent", "partially_failed"]);

  if (sentError) throw new Error(sentError.message);

  return {
    emailsSent: (sentRows ?? []).reduce(
      (total, row) => total + Number(row.sent_count || 0),
      0,
    ),
    delivered: (sentRows ?? []).reduce(
      (total, row) => total + Number(row.delivered_count || 0),
      0,
    ),
    opened: (sentRows ?? []).reduce(
      (total, row) => total + Number(row.opened_count || 0),
      0,
    ),
    clicked: (sentRows ?? []).reduce(
      (total, row) => total + Number(row.clicked_count || 0),
      0,
    ),
    bounced: (sentRows ?? []).reduce(
      (total, row) => total + Number(row.bounced_count || 0),
      0,
    ),
    campaignsSent: sentRows?.length ?? 0,
    recent,
  };
}

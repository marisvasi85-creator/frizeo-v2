import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmailTemplate, listEmailTemplates } from "@/lib/frizeo-email/templates";
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
};

export type UpdateCampaignInput = MarketingEmailContent & {
  name: string;
  sender_name: string;
  sender_email: string;
  reply_to: string | null;
  template_id: string | null;
  audience_kind: MarketingAudienceKind;
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

  if (!template) {
    const templates = await listEmailTemplates();
    template = templates.find((item) => item.is_default) ?? templates[0] ?? null;
  }

  if (!template) {
    throw new Error("Nu există niciun template. Creează unul înainte.");
  }

  const sender = getMarketingSenderDefaults();
  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .insert({
      name: input.name,
      subject: template.subject,
      preview_text: template.preview_text,
      sender_name: sender.senderName,
      sender_email: sender.senderEmail,
      reply_to: sender.replyTo,
      template_id: template.id,
      heading: template.heading,
      body_text: template.body_text,
      image_url: template.image_url,
      cta_text: template.cta_text,
      cta_url: template.cta_url,
      footer_text: template.footer_text,
      audience_kind: "all_subscribed",
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

  const currentTestContactIds = [...(current.test_contact_ids || [])].sort();
  const nextTestContactIds = [...input.test_contact_ids].sort();
  const audienceChanged =
    current.audience_kind !== input.audience_kind ||
    currentTestContactIds.join(",") !== nextTestContactIds.join(",");
  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .update({
      ...input,
      ...(audienceChanged
        ? { recipient_count: 0, audience_snapshot_at: null }
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
): Promise<"deleted" | "not_found" | "not_draft"> {
  const campaign = await getCampaign(id);
  if (!campaign) return "not_found";
  if (campaign.status !== "draft") return "not_draft";

  const { error } = await supabaseAdmin
    .from("marketing_campaigns")
    .delete()
    .eq("id", id)
    .eq("status", "draft");

  if (error) throw new Error(error.message);
  return "deleted";
}

function eligibleContactsQuery() {
  return supabaseAdmin
    .from("marketing_contacts")
    .select("id", { count: "exact", head: true })
    .eq("status", "subscribed")
    .eq("marketing_consent", true)
    .not("consent_at", "is", null)
    .is("unsubscribed_at", null);
}

export async function getAudienceSummaries(): Promise<
  MarketingAudienceSummary[]
> {
  const [all, leads, registered, controlledTest] = await Promise.all([
    eligibleContactsQuery(),
    eligibleContactsQuery().is("user_id", null),
    eligibleContactsQuery().not("user_id", "is", null),
    eligibleContactsQuery(),
  ]);

  const firstError =
    all.error || leads.error || registered.error || controlledTest.error;
  if (firstError) throw new Error(firstError.message);

  return [
    {
      kind: "all_subscribed",
      label: "Toate contactele eligibile",
      description: "Subscribed + consimțământ, fără dezabonare.",
      count: all.count ?? 0,
    },
    {
      kind: "leads",
      label: "Lead-uri",
      description: "Contacte eligibile fără cont Frizeo.",
      count: leads.count ?? 0,
    },
    {
      kind: "registered_users",
      label: "Utilizatori înregistrați",
      description: "Contacte eligibile asociate unui cont Frizeo.",
      count: registered.count ?? 0,
    },
    {
      kind: "controlled_test",
      label: "Test controlat",
      description: "Selectează manual maximum 5 contacte eligibile.",
      count: controlledTest.count ?? 0,
    },
  ];
}

export async function listEligibleTestContacts(
  limit = 100,
): Promise<MarketingTestContactOption[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const { data, error } = await supabaseAdmin
    .from("marketing_contacts")
    .select("id, email, first_name, last_name")
    .eq("status", "subscribed")
    .eq("marketing_consent", true)
    .not("consent_at", "is", null)
    .is("unsubscribed_at", null)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingTestContactOption[];
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
      "id, campaign_id, contact_id, email, email_normalized, first_name, last_name, status, provider, provider_message_id, queued_at, sent_at, delivered_at, opened_at, clicked_at, bounced_at, failed_at, error_message, attempt_count, first_attempt_at, last_attempt_at, next_attempt_at, claimed_at, created_at, updated_at",
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
  const count = (statuses?: string[]) => {
    let query = supabaseAdmin
      .from("marketing_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    if (statuses) query = query.in("status", statuses);
    return query;
  };

  const [total, pending, sending, sent, failed, skipped] = await Promise.all([
    count(),
    count(["pending", "queued"]),
    count(["sending"]),
    count(["sent", "delivered", "opened", "clicked"]),
    count(["failed"]),
    count(["skipped"]),
  ]);

  const firstError =
    total.error ||
    pending.error ||
    sending.error ||
    sent.error ||
    failed.error ||
    skipped.error;
  if (firstError) throw new Error(firstError.message);

  return {
    total: total.count ?? 0,
    pending: pending.count ?? 0,
    sending: sending.count ?? 0,
    sent: sent.count ?? 0,
    failed: failed.count ?? 0,
    skipped: skipped.count ?? 0,
  };
}

export async function getCampaignDashboardData(): Promise<{
  emailsSent: number;
  campaignsSent: number;
  recent: MarketingCampaign[];
}> {
  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) throw new Error(error.message);
  const recent = (data ?? []) as MarketingCampaign[];

  const { data: sentRows, error: sentError } = await supabaseAdmin
    .from("marketing_campaigns")
    .select("sent_count")
    .in("status", ["sent", "partially_failed"]);

  if (sentError) throw new Error(sentError.message);

  return {
    emailsSent: (sentRows ?? []).reduce(
      (total, row) => total + Number(row.sent_count || 0),
      0,
    ),
    campaignsSent: sentRows?.length ?? 0,
    recent,
  };
}

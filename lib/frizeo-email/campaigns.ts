import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmailTemplate, listEmailTemplates } from "@/lib/frizeo-email/templates";
import type {
  MarketingAudienceKind,
  MarketingAudienceSummary,
  MarketingCampaign,
  MarketingCampaignRecipient,
  MarketingEmailContent,
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

  const audienceChanged = current.audience_kind !== input.audience_kind;
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

  if (audienceChanged) {
    const { error: recipientError } = await supabaseAdmin
      .from("marketing_campaign_recipients")
      .delete()
      .eq("campaign_id", id);
    if (recipientError) throw new Error(recipientError.message);
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
    .is("unsubscribed_at", null);
}

export async function getAudienceSummaries(): Promise<
  MarketingAudienceSummary[]
> {
  const [all, leads, registered] = await Promise.all([
    eligibleContactsQuery(),
    eligibleContactsQuery().is("user_id", null),
    eligibleContactsQuery().not("user_id", "is", null),
  ]);

  const firstError = all.error || leads.error || registered.error;
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
  ];
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
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingCampaignRecipient[];
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
    .eq("status", "sent");

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

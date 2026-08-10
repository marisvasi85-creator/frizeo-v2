import "server-only";

import { Resend, type WebhookEventPayload } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

const RESEND_EVENT_TYPES = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
} as const;

type SupportedResendEventType = keyof typeof RESEND_EVENT_TYPES;
type WebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

export type MarketingWebhookResult = {
  result: "processed" | "duplicate" | "unmatched";
  matched: boolean;
  duplicate: boolean;
  event_id?: string;
  recipient_id?: string;
  campaign_id?: string;
  automation_run_id?: string;
  contact_id?: string;
};

export function isResendWebhookConfigured(): boolean {
  return Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim());
}

export function verifyResendWebhook(input: {
  rawBody: string;
  headers: WebhookHeaders;
}): WebhookEventPayload {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("resend_webhook_not_configured");
  }

  // Resend's official SDK delegates to Svix and must receive the untouched body.
  // The current SDK constructor expects an API-key-shaped value even though
  // webhooks.verify performs no API request and authenticates only with the
  // dedicated signing secret below.
  const resend = new Resend("re_webhook_signature_verification");
  return resend.webhooks.verify({
    payload: input.rawBody,
    headers: input.headers,
    webhookSecret,
  });
}

function isSupportedEmailEvent(
  event: WebhookEventPayload,
): event is Extract<WebhookEventPayload, { type: SupportedResendEventType }> {
  return event.type in RESEND_EVENT_TYPES;
}

function safeMetadata(
  event: Extract<WebhookEventPayload, { type: SupportedResendEventType }>,
): Record<string, string> {
  const metadata: Record<string, string> = {};
  const tags = event.data.tags;
  const frizeoEmailType = tags?.frizeo_email_type;
  if (frizeoEmailType) metadata.frizeo_email_type = frizeoEmailType.slice(0, 80);

  if (event.type === "email.clicked") {
    metadata.link = event.data.click.link.slice(0, 2_000);
  } else if (event.type === "email.bounced") {
    metadata.bounce_type = event.data.bounce.type.slice(0, 120);
    metadata.bounce_subtype = event.data.bounce.subType.slice(0, 120);
    metadata.reason = event.data.bounce.message.slice(0, 1_000);
  } else if (event.type === "email.failed") {
    metadata.reason = event.data.failed.reason.slice(0, 1_000);
  } else if (event.type === "email.suppressed") {
    metadata.suppression_type = event.data.suppressed.type.slice(0, 120);
    metadata.reason = event.data.suppressed.message.slice(0, 1_000);
  }

  return metadata;
}

export function isMarketingCampaignEvent(event: WebhookEventPayload): boolean {
  if (!("email_id" in event.data) || !("tags" in event.data)) return false;
  return event.data.tags?.frizeo_email_type === "marketing-campaign";
}

export function isMarketingAutomationEvent(
  event: WebhookEventPayload,
): boolean {
  if (!("email_id" in event.data) || !("tags" in event.data)) return false;
  return event.data.tags?.frizeo_email_type === "marketing-automation";
}

export function isRetryableUnmatchedMarketingEvent(
  event: WebhookEventPayload,
): boolean {
  return isMarketingCampaignEvent(event) || isMarketingAutomationEvent(event);
}

export async function processVerifiedResendWebhook(input: {
  providerEventId: string;
  event: WebhookEventPayload;
}): Promise<MarketingWebhookResult | { result: "ignored" }> {
  const { event } = input;
  if (!isSupportedEmailEvent(event)) {
    return { result: "ignored" };
  }

  const eventTimestamp = new Date(event.created_at);
  if (Number.isNaN(eventTimestamp.getTime())) {
    throw new Error("invalid_resend_event_timestamp");
  }

  const bounce = event.type === "email.bounced" ? event.data.bounce : null;
  const payload = {
    p_provider: "resend",
    p_provider_event_id: input.providerEventId,
    p_provider_message_id: event.data.email_id,
    p_type: RESEND_EVENT_TYPES[event.type],
    p_event_timestamp: eventTimestamp.toISOString(),
    p_metadata: safeMetadata(event),
    p_bounce_type: bounce?.type ?? null,
    p_bounce_subtype: bounce?.subType ?? null,
    p_bounce_reason: bounce?.message ?? null,
    p_permanent_bounce: bounce?.type.toLowerCase() === "permanent",
  };

  const { data, error } = await supabaseAdmin.rpc(
    "process_marketing_email_event",
    payload,
  );

  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") {
    throw new Error("invalid_marketing_webhook_result");
  }

  const campaignResult = data as MarketingWebhookResult;
  if (campaignResult.result !== "unmatched") {
    return campaignResult;
  }

  const { data: automationData, error: automationError } =
    await supabaseAdmin.rpc(
      "process_marketing_automation_email_event",
      payload,
    );

  if (automationError) throw new Error(automationError.message);
  if (!automationData || typeof automationData !== "object") {
    throw new Error("invalid_marketing_automation_webhook_result");
  }

  return automationData as MarketingWebhookResult;
}

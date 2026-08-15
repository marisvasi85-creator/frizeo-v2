import "server-only";

import {
  claimMarketingRecipientBatch,
  recordMarketingRecipientResult,
} from "@/lib/frizeo-email/campaigns";
import {
  MarketingProviderError,
  sendMarketingEmail,
} from "@/lib/frizeo-email/provider";
import {
  renderMarketingEmail,
  renderMarketingEmailText,
} from "@/lib/frizeo-email/renderEmail";
import { buildUnsubscribeUrl } from "@/lib/frizeo-email/unsubscribe";
import { getFrizeoAppUrl } from "@/lib/frizeo-email/config";
import { maybeWrapCtaWithAttribution } from "@/lib/frizeo-email/attribution";
import { resolveMarketingTemplateVariables } from "@/lib/frizeo-email/templateVariables";
import { publicSalonUrl } from "@/lib/booking/publicBookingPath";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 10;
const MAX_ATTEMPTS = 4;
const CLAIM_LEASE_SECONDS = 10 * 60;
const SEND_THROTTLE_MS = 400;
const RETRY_DELAYS_SECONDS = [60, 5 * 60, 15 * 60, 60 * 60] as const;

function marketingBatchSize(): number {
  const configured = Number(process.env.MARKETING_BATCH_SIZE || "");
  if (!Number.isInteger(configured) || configured <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(configured, MAX_BATCH_SIZE);
}

function retryDelaySeconds(
  attemptCount: number,
  providerRetryAfter: number | null,
): number {
  const fallback =
    RETRY_DELAYS_SECONDS[
      Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_SECONDS.length - 1)
    ];
  return Math.max(fallback, providerRetryAfter || 0);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeErrorCode(error: unknown): string {
  if (error instanceof MarketingProviderError) {
    return `${error.code}${error.statusCode ? `:${error.statusCode}` : ""}`;
  }
  return error instanceof Error ? error.name : "worker_error";
}

export type MarketingWorkerResult = {
  batchSize: number;
  claimed: number;
  sent: number;
  retryScheduled: number;
  failed: number;
  staleResults: number;
};

async function recipientBookingLink(
  contactId: string | null,
  appUrl: string,
): Promise<string | null> {
  if (!contactId) return null;
  const { data: contact } = await supabaseAdmin
    .from("marketing_contacts")
    .select("tenant_id")
    .eq("id", contactId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!contact?.tenant_id) return null;
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("slug")
    .eq("id", contact.tenant_id)
    .maybeSingle();
  return tenant?.slug ? publicSalonUrl(tenant.slug, appUrl) : null;
}

export async function processMarketingBatch(input: {
  emailAppUrl: string;
}): Promise<MarketingWorkerResult> {
  const batchSize = marketingBatchSize();
  const recipients = await claimMarketingRecipientBatch({
    batchSize,
    leaseSeconds: CLAIM_LEASE_SECONDS,
    maxAttempts: MAX_ATTEMPTS,
  });

  const result: MarketingWorkerResult = {
    batchSize,
    claimed: recipients.length,
    sent: 0,
    retryScheduled: 0,
    failed: 0,
    staleResults: 0,
  };

  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];
    const logContext = {
      campaignId: recipient.campaign_id,
      recipientId: recipient.recipient_id,
      attempt: recipient.attempt_count,
    };

    try {
      if (!recipient.unsubscribe_token) {
        throw new MarketingProviderError({
          code: "missing_unsubscribe_token",
          message: "Recipient is missing its unsubscribe token.",
          temporary: false,
        });
      }

      const unsubscribeUrl = buildUnsubscribeUrl(
        recipient.unsubscribe_token,
        input.emailAppUrl,
      );
      const appUrl = getFrizeoAppUrl();
      const resolvedContent = resolveMarketingTemplateVariables(recipient, {
        first_name: recipient.first_name,
        app_url: appUrl,
        booking_link: await recipientBookingLink(recipient.contact_id, appUrl),
      });
      const wrappedCta = await maybeWrapCtaWithAttribution({
        ctaUrl: resolvedContent.cta_url,
        sourceKind: "campaign",
        campaignId: recipient.campaign_id,
        recipientId: recipient.recipient_id,
        contactId: recipient.contact_id,
        utmCampaign: recipient.campaign_id,
        isTest: false,
      });
      if (wrappedCta) resolvedContent.cta_url = wrappedCta;
      const renderInput = { ...resolvedContent, unsubscribeUrl };
      const providerResult = await sendMarketingEmail({
        kind: "marketing-campaign",
        idempotencyKey: `frizeo-campaign/${recipient.campaign_id}/${recipient.recipient_id}`,
        to: recipient.recipient_email,
        subject: resolvedContent.subject,
        html: renderMarketingEmail(renderInput),
        text: renderMarketingEmailText(renderInput),
      });

      const recorded = await recordMarketingRecipientResult({
        recipientId: recipient.recipient_id,
        claimToken: recipient.claim_token,
        success: true,
        providerMessageId: providerResult.messageId,
        maxAttempts: MAX_ATTEMPTS,
      });

      if (recorded) {
        result.sent += 1;
        console.info("[marketing-worker] recipient sent", {
          ...logContext,
          providerMessageId: providerResult.messageId,
        });
      } else {
        result.staleResults += 1;
        console.warn("[marketing-worker] stale success ignored", logContext);
      }
    } catch (error) {
      const providerError =
        error instanceof MarketingProviderError ? error : null;
      const temporary = providerError?.temporary ?? true;
      const retryDelay = retryDelaySeconds(
        recipient.attempt_count,
        providerError?.retryAfterSeconds ?? null,
      );
      const recorded = await recordMarketingRecipientResult({
        recipientId: recipient.recipient_id,
        claimToken: recipient.claim_token,
        success: false,
        temporary,
        errorMessage: safeErrorCode(error),
        retryDelaySeconds: retryDelay,
        maxAttempts: MAX_ATTEMPTS,
      });

      if (!recorded) {
        result.staleResults += 1;
        console.warn("[marketing-worker] stale failure ignored", logContext);
      } else if (temporary && recipient.attempt_count < MAX_ATTEMPTS) {
        result.retryScheduled += 1;
        console.warn("[marketing-worker] retry scheduled", {
          ...logContext,
          error: safeErrorCode(error),
          retryDelaySeconds: retryDelay,
        });
      } else {
        result.failed += 1;
        console.error("[marketing-worker] recipient failed", {
          ...logContext,
          error: safeErrorCode(error),
        });
      }
    }

    if (index < recipients.length - 1) {
      await delay(SEND_THROTTLE_MS);
    }
  }

  return result;
}

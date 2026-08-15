import "server-only";

import {
  claimAutomationRunBatch,
  discoverAutomationRuns,
  evaluateAutomationConditions,
  recordAutomationRunResult,
  type ClaimedAutomationRun,
} from "@/lib/frizeo-email/automations";
import {
  MarketingProviderError,
  sendMarketingEmail,
} from "@/lib/frizeo-email/provider";
import {
  renderMarketingEmail,
  renderMarketingEmailText,
} from "@/lib/frizeo-email/renderEmail";
import { buildUnsubscribeUrl } from "@/lib/frizeo-email/unsubscribe";
import { maybeWrapCtaWithAttribution } from "@/lib/frizeo-email/attribution";
import { getFrizeoAppUrl } from "@/lib/frizeo-email/config";
import {
  marketingCtaUrl,
  resolveMarketingTemplateVariables,
} from "@/lib/frizeo-email/templateVariables";
import { publicSalonUrl } from "@/lib/booking/publicBookingPath";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MarketingCtaUrlType, MarketingEmailContent } from "@/lib/frizeo-email/types";

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
  return error instanceof Error ? error.name : "automation_worker_error";
}

async function bookingLinkForTenant(
  tenantId: string | null,
  appUrl: string,
): Promise<string | null> {
  if (!tenantId) return null;
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .maybeSingle();
  return tenant?.slug ? publicSalonUrl(tenant.slug, appUrl) : null;
}

function contentFromClaim(run: ClaimedAutomationRun): MarketingEmailContent {
  return {
    subject: run.subject,
    preview_text: run.preview_text,
    heading: run.heading,
    body_text: run.body_text,
    image_url: run.image_url,
    cta_text: run.cta_text,
    cta_url: run.cta_url,
    footer_text: run.footer_text,
  };
}

export type AutomationWorkerResult = {
  discovered: number;
  batchSize: number;
  claimed: number;
  sent: number;
  skipped: number;
  retryScheduled: number;
  failed: number;
  staleResults: number;
};

export async function processAutomationDiscoverAndExecute(input: {
  emailAppUrl: string;
  discover?: boolean;
  execute?: boolean;
}): Promise<AutomationWorkerResult> {
  const shouldDiscover = input.discover !== false;
  const shouldExecute = input.execute !== false;

  let discovered = 0;
  if (shouldDiscover) {
    const discovery = await discoverAutomationRuns(200);
    discovered = Number(discovery?.inserted || 0);
  }

  const result: AutomationWorkerResult = {
    discovered,
    batchSize: marketingBatchSize(),
    claimed: 0,
    sent: 0,
    skipped: 0,
    retryScheduled: 0,
    failed: 0,
    staleResults: 0,
  };

  if (!shouldExecute) return result;

  const runs = await claimAutomationRunBatch({
    batchSize: result.batchSize,
    leaseSeconds: CLAIM_LEASE_SECONDS,
    maxAttempts: MAX_ATTEMPTS,
  });
  result.claimed = runs.length;

  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    const logContext = {
      runId: run.run_id,
      automationKey: run.automation_key,
      attempt: run.attempt_count,
    };

    try {
      const condition = await evaluateAutomationConditions(
        run.contact_id,
        (run.conditions || {}) as Record<string, unknown>,
      );

      if (!condition.ok) {
        const recorded = await recordAutomationRunResult({
          runId: run.run_id,
          claimToken: run.claim_token,
          outcome: "skipped",
          skipReason: condition.skip_reason || "condition_failed",
          maxAttempts: MAX_ATTEMPTS,
        });
        if (recorded) result.skipped += 1;
        else result.staleResults += 1;
        continue;
      }

      if (!run.unsubscribe_token) {
        throw new MarketingProviderError({
          code: "missing_unsubscribe_token",
          message: "Automation run is missing unsubscribe token.",
          temporary: false,
        });
      }

      const appUrl = getFrizeoAppUrl();
      const bookingLink = await bookingLinkForTenant(run.tenant_id, appUrl);
      const ctaType = (run.cta_url_type || "custom") as MarketingCtaUrlType;
      const resolvedCta =
        ctaType === "custom"
          ? run.cta_url
          : ctaType === "booking_link"
            ? bookingLink
            : marketingCtaUrl(ctaType, appUrl);

      const content = contentFromClaim(run);
      if (resolvedCta) content.cta_url = resolvedCta;

      const trialEndDate = run.trial_end_date
        ? String(run.trial_end_date)
        : null;

      const resolvedContent = resolveMarketingTemplateVariables(content, {
        first_name: run.first_name,
        app_url: appUrl,
        booking_link: bookingLink,
        trial_end_date: trialEndDate,
      });

      const wrappedCta = await maybeWrapCtaWithAttribution({
        ctaUrl: resolvedContent.cta_url,
        sourceKind: "automation",
        automationId: run.automation_id,
        automationRunId: run.run_id,
        contactId: run.contact_id,
        utmCampaign: run.automation_key,
        isTest: false,
      });
      if (wrappedCta) resolvedContent.cta_url = wrappedCta;

      const unsubscribeUrl = buildUnsubscribeUrl(
        run.unsubscribe_token,
        input.emailAppUrl,
      );
      const renderInput = { ...resolvedContent, unsubscribeUrl };

      const providerResult = await sendMarketingEmail({
        kind: "marketing-automation",
        idempotencyKey: `frizeo-automation/${run.run_id}/${run.attempt_count}`,
        to: run.contact_email,
        subject: resolvedContent.subject,
        html: renderMarketingEmail(renderInput),
        text: renderMarketingEmailText(renderInput),
      });

      const recorded = await recordAutomationRunResult({
        runId: run.run_id,
        claimToken: run.claim_token,
        outcome: "sent",
        provider: providerResult.provider,
        providerMessageId: providerResult.messageId,
        maxAttempts: MAX_ATTEMPTS,
      });

      if (recorded) {
        result.sent += 1;
        console.info("[marketing-automation-worker] sent", {
          ...logContext,
          providerMessageId: providerResult.messageId,
        });
      } else {
        result.staleResults += 1;
      }
    } catch (error) {
      const providerError =
        error instanceof MarketingProviderError ? error : null;
      const temporary = providerError?.temporary ?? true;
      const retryDelay = retryDelaySeconds(
        run.attempt_count,
        providerError?.retryAfterSeconds ?? null,
      );

      const recorded = await recordAutomationRunResult({
        runId: run.run_id,
        claimToken: run.claim_token,
        outcome: temporary ? "retry" : "failed",
        temporary,
        errorMessage: safeErrorCode(error),
        retryDelaySeconds: retryDelay,
        maxAttempts: MAX_ATTEMPTS,
      });

      if (!recorded) {
        result.staleResults += 1;
      } else if (temporary && run.attempt_count < MAX_ATTEMPTS) {
        result.retryScheduled += 1;
        console.warn("[marketing-automation-worker] retry", {
          ...logContext,
          error: safeErrorCode(error),
          retryDelaySeconds: retryDelay,
        });
      } else {
        result.failed += 1;
        console.error("[marketing-automation-worker] failed", {
          ...logContext,
          error: safeErrorCode(error),
        });
      }
    }

    if (index < runs.length - 1) {
      await delay(SEND_THROTTLE_MS);
    }
  }

  return result;
}

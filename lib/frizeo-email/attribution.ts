import "server-only";

import { cookies } from "next/headers";
import type Stripe from "stripe";
import { getFrizeoAppUrl } from "@/lib/frizeo-email/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MarketingConversionStats } from "@/lib/frizeo-email/types";
import type { FirstPartyAnalyticsContext } from "@/lib/analytics/firstParty";

export const ATTRIBUTION_COOKIE = "fe_attr";
export const ATTRIBUTION_WINDOW_DAYS = 30;
const ATTRIBUTION_WINDOW_MS = ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type AttributionSourceKind = "campaign" | "automation";

export type AttributionLinkRow = {
  id: string;
  source_kind: AttributionSourceKind;
  campaign_id: string | null;
  automation_id: string | null;
  destination_url: string;
  utm_campaign: string | null;
  is_test: boolean;
  clicked_at: string | null;
  created_at: string;
  contact_id: string | null;
};

function emptyStats(): MarketingConversionStats {
  return {
    signups: 0,
    trials: 0,
    paid: 0,
    signup_rate: null,
    trial_rate: null,
    paid_rate: null,
    attributed_mrr: 0,
    currency: "RON",
  };
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function summarizeConversions(
  rows: Array<{
    conversion_type: string;
    mrr_amount: number | string | null;
    currency: string | null;
  }>,
  sentDenominator = 0,
): MarketingConversionStats {
  const stats = emptyStats();
  let currency: string | null = null;
  for (const row of rows) {
    if (row.conversion_type === "signup") stats.signups += 1;
    if (row.conversion_type === "trial_started") stats.trials += 1;
    if (row.conversion_type === "subscription_started") {
      stats.paid += 1;
      stats.attributed_mrr += Number(row.mrr_amount || 0);
      if (!currency && row.currency) currency = row.currency;
    }
  }
  stats.currency = currency || "RON";
  stats.signup_rate = rate(stats.signups, sentDenominator);
  stats.trial_rate = rate(stats.trials, sentDenominator);
  stats.paid_rate = rate(stats.paid, sentDenominator);
  return stats;
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildAttributionRedirectUrl(
  linkId: string,
  appUrl = getFrizeoAppUrl(),
): string {
  return `${appUrl.replace(/\/$/, "")}/api/email/r/${encodeURIComponent(linkId)}`;
}

export function appendMarketingUtmParams(
  destinationUrl: string,
  utmCampaign: string | null | undefined,
): string {
  const base = safeHttpUrl(destinationUrl);
  if (!base) return destinationUrl;
  const url = new URL(base);
  if (!url.searchParams.has("utm_source")) {
    url.searchParams.set("utm_source", "frizeo_email");
  }
  if (!url.searchParams.has("utm_medium")) {
    url.searchParams.set("utm_medium", "email");
  }
  if (utmCampaign && !url.searchParams.has("utm_campaign")) {
    url.searchParams.set("utm_campaign", utmCampaign.slice(0, 120));
  }
  return url.toString();
}

export async function createAttributionLink(input: {
  sourceKind: AttributionSourceKind;
  campaignId?: string | null;
  automationId?: string | null;
  recipientId?: string | null;
  automationRunId?: string | null;
  contactId?: string | null;
  destinationUrl: string;
  utmCampaign?: string | null;
  isTest?: boolean;
}): Promise<string | null> {
  const destination = safeHttpUrl(input.destinationUrl);
  if (!destination) return null;
  if (input.sourceKind === "campaign" && !input.campaignId) return null;
  if (input.sourceKind === "automation" && !input.automationId) return null;

  const { data, error } = await supabaseAdmin
    .from("marketing_attribution_links")
    .insert({
      source_kind: input.sourceKind,
      campaign_id: input.campaignId ?? null,
      automation_id: input.automationId ?? null,
      recipient_id: input.recipientId ?? null,
      automation_run_id: input.automationRunId ?? null,
      contact_id: input.contactId ?? null,
      destination_url: destination,
      utm_campaign: input.utmCampaign ?? null,
      is_test: Boolean(input.isTest),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[marketing-attribution] create link failed", error?.message);
    return null;
  }
  return data.id as string;
}

/** Wrap CTA with opaque redirect when possible; never throw. */
export async function maybeWrapCtaWithAttribution(input: {
  ctaUrl: string | null | undefined;
  sourceKind: AttributionSourceKind;
  campaignId?: string | null;
  automationId?: string | null;
  recipientId?: string | null;
  automationRunId?: string | null;
  contactId?: string | null;
  utmCampaign?: string | null;
  isTest?: boolean;
}): Promise<string | null> {
  try {
    if (!input.ctaUrl?.trim() || input.isTest) {
      return input.ctaUrl ?? null;
    }
    const linkId = await createAttributionLink({
      sourceKind: input.sourceKind,
      campaignId: input.campaignId,
      automationId: input.automationId,
      recipientId: input.recipientId,
      automationRunId: input.automationRunId,
      contactId: input.contactId,
      destinationUrl: input.ctaUrl,
      utmCampaign: input.utmCampaign,
      isTest: false,
    });
    if (!linkId) return input.ctaUrl;
    return buildAttributionRedirectUrl(linkId);
  } catch (error) {
    console.error("[marketing-attribution] wrap CTA failed", error);
    return input.ctaUrl ?? null;
  }
}

export function isAttributionFresh(
  clickedOrCreatedAt: string,
  now = Date.now(),
): boolean {
  const created = Date.parse(clickedOrCreatedAt);
  if (!Number.isFinite(created)) return false;
  return now - created <= ATTRIBUTION_WINDOW_MS;
}

export async function getAttributionLink(
  token: string | null | undefined,
): Promise<AttributionLinkRow | null> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data, error } = await supabaseAdmin
    .from("marketing_attribution_links")
    .select(
      "id, source_kind, campaign_id, automation_id, destination_url, utm_campaign, is_test, clicked_at, created_at, contact_id",
    )
    .eq("id", token)
    .maybeSingle();
  if (error || !data) return null;
  return data as AttributionLinkRow;
}

/** Record first-party click; never throws to callers. */
export async function markAttributionLinkClicked(linkId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("marketing_attribution_links")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", linkId)
      .is("clicked_at", null);
  } catch (error) {
    console.error("[marketing-attribution] mark click failed", error);
  }
}

export async function readAttributionCookieToken(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(ATTRIBUTION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export function attributionCookieOptions(maxAgeSeconds = ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

async function resolveContactIdByEmail(email: string | null | undefined): Promise<string | null> {
  if (!email?.trim()) return null;
  const normalized = email.trim().toLowerCase();
  const { data } = await supabaseAdmin
    .from("marketing_contacts")
    .select("id")
    .eq("email_normalized", normalized)
    .is("deleted_at", null)
    .maybeSingle();
  return data?.id ?? null;
}

async function insertConversion(row: {
  conversion_type: "signup" | "trial_started" | "subscription_started";
  attribution_role: "acquisition" | "lifecycle";
  user_id: string | null;
  tenant_id: string | null;
  contact_id: string | null;
  attribution_link_id: string | null;
  campaign_id: string | null;
  automation_id: string | null;
  plan_id?: string | null;
  plan_slug?: string | null;
  amount?: number | null;
  currency?: string | null;
  billing_interval?: string | null;
  mrr_amount?: number | null;
  visitor_id?: string | null;
  session_id?: string | null;
  source?: string | null;
  medium?: string | null;
  utm_campaign?: string | null;
  landing_path?: string | null;
  referrer_host?: string | null;
  idempotency_key: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from("marketing_conversions").insert(row);
  if (!error) return true;
  if (error.code === "23505") return false; // duplicate idempotency key
  console.error("[marketing-attribution] insert conversion failed", error.message);
  return false;
}

export async function recordSignupAndTrialConversions(input: {
  userId: string;
  tenantId: string;
  email: string;
  analyticsContext?: FirstPartyAnalyticsContext | null;
}): Promise<void> {
  try {
    const token = await readAttributionCookieToken();
    const link = await getAttributionLink(token);
    const valid =
      link &&
      !link.is_test &&
      isAttributionFresh(link.clicked_at || link.created_at)
        ? link
        : null;

    const contactId =
      valid?.contact_id || (await resolveContactIdByEmail(input.email));

    const common = {
      attribution_role: "acquisition" as const,
      user_id: input.userId,
      tenant_id: input.tenantId,
      contact_id: contactId,
      attribution_link_id: valid?.id ?? null,
      campaign_id: valid?.campaign_id ?? null,
      automation_id: valid?.automation_id ?? null,
      visitor_id: input.analyticsContext?.visitorId ?? null,
      session_id: input.analyticsContext?.sessionId ?? null,
      source: valid ? "frizeo_email" : input.analyticsContext?.source ?? null,
      medium: valid ? "email" : input.analyticsContext?.medium ?? null,
      utm_campaign:
        valid?.utm_campaign ?? input.analyticsContext?.campaign ?? null,
      landing_path: input.analyticsContext?.landingPath ?? null,
      referrer_host: input.analyticsContext?.referrerHost ?? null,
    };

    await insertConversion({
      ...common,
      conversion_type: "signup",
      idempotency_key: `signup:user:${input.userId}`,
    });
    await insertConversion({
      ...common,
      conversion_type: "trial_started",
      idempotency_key: `trial_started:tenant:${input.tenantId}`,
    });
  } catch (error) {
    console.error("[marketing-attribution] signup capture failed", error);
  }
}

export function mrrFromStripePrice(price: Stripe.Price | undefined | null): {
  amount: number | null;
  currency: string | null;
  billing_interval: string | null;
  mrr_amount: number | null;
} {
  if (!price || price.unit_amount == null) {
    return {
      amount: null,
      currency: null,
      billing_interval: null,
      mrr_amount: null,
    };
  }
  const amount = price.unit_amount / 100;
  const currency = (price.currency || "ron").toUpperCase();
  const interval = price.recurring?.interval ?? null;
  let mrr: number | null = null;
  if (interval === "month") mrr = amount;
  else if (interval === "year") mrr = Math.round((amount / 12) * 100) / 100;
  else if (interval === "week") mrr = Math.round(amount * 4.333 * 100) / 100;
  return {
    amount,
    currency,
    billing_interval: interval,
    mrr_amount: mrr,
  };
}

async function planRevenueSnapshot(planId: string | null | undefined): Promise<{
  plan_id: string | null;
  plan_slug: string | null;
  amount: number | null;
  currency: string;
  billing_interval: string;
  mrr_amount: number | null;
}> {
  if (!planId) {
    return {
      plan_id: null,
      plan_slug: null,
      amount: null,
      currency: "RON",
      billing_interval: "month",
      mrr_amount: null,
    };
  }
  const { data } = await supabaseAdmin
    .from("plans")
    .select("id, slug, price")
    .eq("id", planId)
    .maybeSingle();
  const price = data?.price != null ? Number(data.price) : null;
  const mrr =
    price != null && Number.isFinite(price) && price > 0 ? price : null;
  return {
    plan_id: data?.id ?? planId,
    plan_slug: data?.slug ?? null,
    amount: mrr,
    currency: "RON",
    billing_interval: "month",
    mrr_amount: mrr,
  };
}

export async function recordPaidSubscriptionConversion(input: {
  tenantId: string;
  userId?: string | null;
  planId?: string | null;
  stripePrice?: Stripe.Price | null;
}): Promise<void> {
  try {
    const token = await readAttributionCookieToken().catch(() => null);
    // Stripe webhooks have no browser cookie — use last automation/campaign
    // acquisition from signup conversion, and prefer a recent automation
    // lifecycle source when present via prior conversions / links is N/A.
    // For server webhooks: attribute lifecycle to most recent non-test
    // automation conversion touch for this tenant within window, else acquisition.
    let campaignId: string | null = null;
    let automationId: string | null = null;
    let attributionLinkId: string | null = null;
    let role: "acquisition" | "lifecycle" = "acquisition";
    let contactId: string | null = null;
    let userId = input.userId ?? null;
    let visitorId: string | null = null;
    let sessionId: string | null = null;
    let source: string | null = null;
    let medium: string | null = null;
    let utmCampaign: string | null = null;
    let landingPath: string | null = null;
    let referrerHost: string | null = null;

    // Cookie is usually absent on Stripe webhooks — use persisted clicks.
    if (token) {
      const link = await getAttributionLink(token);
      if (
        link &&
        !link.is_test &&
        isAttributionFresh(link.clicked_at || link.created_at)
      ) {
        campaignId = link.campaign_id;
        automationId = link.automation_id;
        attributionLinkId = link.id;
        contactId = link.contact_id;
        role = link.source_kind === "automation" ? "lifecycle" : "acquisition";
        source = "frizeo_email";
        medium = "email";
        utmCampaign = link.utm_campaign;
      }
    }

    if (!campaignId && !automationId) {
      const { data: signupConv } = await supabaseAdmin
        .from("marketing_conversions")
        .select(
          "user_id, contact_id, campaign_id, automation_id, attribution_link_id, visitor_id, session_id, source, medium, utm_campaign, landing_path, referrer_host, occurred_at",
        )
        .eq("tenant_id", input.tenantId)
        .eq("conversion_type", "signup")
        .order("occurred_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (signupConv) {
        userId = userId || signupConv.user_id;
        contactId = contactId || signupConv.contact_id;
        visitorId = signupConv.visitor_id;
        sessionId = signupConv.session_id;
        source = signupConv.source;
        medium = signupConv.medium;
        utmCampaign = signupConv.utm_campaign;
        landingPath = signupConv.landing_path;
        referrerHost = signupConv.referrer_host;
      }

      // Last clicked automation link for this contact within the 30-day window.
      if (contactId) {
        const since = new Date(Date.now() - ATTRIBUTION_WINDOW_MS).toISOString();
        const { data: lifecycleLink } = await supabaseAdmin
          .from("marketing_attribution_links")
          .select(
            "id, campaign_id, automation_id, created_at, clicked_at, source_kind",
          )
          .eq("contact_id", contactId)
          .eq("source_kind", "automation")
          .eq("is_test", false)
          .not("clicked_at", "is", null)
          .gte("clicked_at", since)
          .order("clicked_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (
          lifecycleLink &&
          isAttributionFresh(lifecycleLink.clicked_at || lifecycleLink.created_at)
        ) {
          automationId = lifecycleLink.automation_id;
          campaignId = null;
          attributionLinkId = lifecycleLink.id;
          role = "lifecycle";
          source = "frizeo_email";
          medium = "email";
        } else if (signupConv) {
          campaignId = signupConv.campaign_id;
          automationId = signupConv.automation_id;
          attributionLinkId = signupConv.attribution_link_id;
          role = "acquisition";
        }
      } else if (signupConv) {
        campaignId = signupConv.campaign_id;
        automationId = signupConv.automation_id;
        attributionLinkId = signupConv.attribution_link_id;
      }
    }

    const stripeSnap = mrrFromStripePrice(input.stripePrice ?? null);
    const planSnap = await planRevenueSnapshot(input.planId);
    const amount = stripeSnap.amount ?? planSnap.amount;
    const currency = stripeSnap.currency ?? planSnap.currency;
    const billingInterval =
      stripeSnap.billing_interval ?? planSnap.billing_interval;
    const mrr = stripeSnap.mrr_amount ?? planSnap.mrr_amount;

    await insertConversion({
      conversion_type: "subscription_started",
      attribution_role: role,
      user_id: userId,
      tenant_id: input.tenantId,
      contact_id: contactId,
      attribution_link_id: attributionLinkId,
      campaign_id: campaignId,
      automation_id: automationId,
      plan_id: planSnap.plan_id,
      plan_slug: planSnap.plan_slug,
      amount,
      currency,
      billing_interval: billingInterval,
      mrr_amount: mrr,
      visitor_id: visitorId,
      session_id: sessionId,
      source,
      medium,
      utm_campaign: utmCampaign,
      landing_path: landingPath,
      referrer_host: referrerHost,
      idempotency_key: `subscription_started:tenant:${input.tenantId}`,
    });
  } catch (error) {
    console.error("[marketing-attribution] paid capture failed", error);
  }
}

export async function getConversionStatsForCampaign(
  campaignId: string,
  sentCount = 0,
): Promise<MarketingConversionStats> {
  const { data, error } = await supabaseAdmin
    .from("marketing_conversions")
    .select("conversion_type, mrr_amount, currency")
    .eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);
  return summarizeConversions(data ?? [], sentCount);
}

export async function getConversionStatsForAutomation(
  automationId: string,
  sentCount = 0,
): Promise<MarketingConversionStats> {
  const { data, error } = await supabaseAdmin
    .from("marketing_conversions")
    .select("conversion_type, mrr_amount, currency")
    .eq("automation_id", automationId);
  if (error) throw new Error(error.message);
  return summarizeConversions(data ?? [], sentCount);
}

export async function getConversionStatsLastDays(
  days = 30,
): Promise<MarketingConversionStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("marketing_conversions")
    .select("conversion_type, mrr_amount, currency")
    .gte("occurred_at", since);
  if (error) throw new Error(error.message);
  return summarizeConversions(data ?? [], 0);
}

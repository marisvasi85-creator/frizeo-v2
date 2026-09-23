import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app/getAppUrl";
import {
  barberBelongsToTenant,
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
import { resolveMarketingBarberId, serviceBelongsToBarber } from "@/lib/marketing-ai/access";
import { buildMarketingContext } from "@/lib/marketing-ai/buildContext";
import {
  defaultChannelForContentType,
  isMarketingChannel,
  utmSourceForChannel,
  type MarketingChannel,
} from "@/lib/marketing-ai/channels";
import {
  generateMarketingContent,
  isMarketingAIConfigured,
  publicGenerateError,
} from "@/lib/marketing-ai/generate";
import { loadOpenSlotSummary } from "@/lib/marketing-ai/loadOpenSlots";
import {
  formatMarketingAILimitMessage,
  getMarketingAILimitForPlan,
} from "@/lib/marketing-ai/limits";
import { shouldCountGeneration } from "@/lib/marketing-ai/quota";
import { getMarketingAIProviderConfig } from "@/lib/marketing-ai/providers/config";
import {
  getMarketingAIUsageStatus,
  persistMarketingVariants,
  releaseMarketingAIQuota,
  reserveMarketingAIQuota,
} from "@/lib/marketing-ai/usage";
import { withMarketingTracking } from "@/lib/marketing-ai/tracking";
import {
  MARKETING_CONTENT_TYPES,
  MARKETING_EXTRA_NOTES_MAX,
  MARKETING_VARIANT_COUNT,
  isMarketingTone,
  type MarketingContentType,
  type MarketingTone,
  type OpenSlotDayFact,
} from "@/lib/marketing-ai/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const UNAVAILABLE =
  "Marketing AI este temporar indisponibil. Încearcă din nou mai târziu.";

function isMarketingContentType(value: string): value is MarketingContentType {
  return MARKETING_CONTENT_TYPES.includes(value as MarketingContentType);
}

function trackedLinks(bookingUrl: string, batchId: string) {
  const origin = getAppUrl();
  const links: Record<string, string> = {};
  for (const source of ["instagram", "facebook", "tiktok", "whatsapp", "qr", "story"] as const) {
    links[source] =
      withMarketingTracking(bookingUrl, {
        source,
        batchId,
        appOrigin: origin,
      }) || bookingUrl;
  }
  return links;
}

export async function POST(req: Request) {
  const auth = await requireTenantAccess(["owner", "manager", "barber"]);
  if (isAuthError(auth)) return auth;

  let body: {
    contentType?: string;
    barberId?: string;
    serviceId?: string;
    extraNotes?: string;
    tone?: string;
    channel?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const contentType = body.contentType;
  if (!contentType || !isMarketingContentType(contentType)) {
    return NextResponse.json({ error: "Tip conținut invalid" }, { status: 400 });
  }

  const channel: MarketingChannel =
    body.channel && isMarketingChannel(body.channel)
      ? body.channel
      : defaultChannelForContentType(contentType);

  const currentBarberId =
    auth.role === "barber"
      ? await getCurrentBarberId(auth.user.id, auth.tenantId)
      : null;

  const resolvedBarber = resolveMarketingBarberId({
    role: auth.role,
    requestedBarberId: body.barberId,
    currentBarberId,
  });
  if (!resolvedBarber.ok) {
    return NextResponse.json(
      { error: resolvedBarber.error },
      { status: resolvedBarber.status },
    );
  }

  const belongs = await barberBelongsToTenant(
    supabaseAdmin,
    resolvedBarber.barberId,
    auth.tenantId,
  );
  if (!belongs) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (contentType === "service_promo" && !body.serviceId) {
    return NextResponse.json(
      { error: "Alege serviciul de promovat" },
      { status: 400 },
    );
  }

  const tone: MarketingTone | undefined =
    body.tone && isMarketingTone(body.tone) ? body.tone : undefined;
  const extraNotes = body.extraNotes?.trim()
    ? body.extraNotes.trim().slice(0, MARKETING_EXTRA_NOTES_MAX)
    : undefined;

  const context = await buildMarketingContext(auth.tenantId, resolvedBarber.barberId);
  if (!context) {
    return NextResponse.json({ error: "Date salon indisponibile" }, { status: 404 });
  }

  if (body.serviceId && !serviceBelongsToBarber(
    context.services.map((service) => service.id),
    body.serviceId,
  )) {
    return NextResponse.json({ error: "Serviciu invalid" }, { status: 400 });
  }

  const selectedService = body.serviceId
    ? context.services.find((service) => service.id === body.serviceId) || null
    : null;

  let openSlots: OpenSlotDayFact[] | undefined;
  if (contentType === "open_slots") {
    const availability = await loadOpenSlotSummary({
      barberId: resolvedBarber.barberId,
      durationMinutes: selectedService?.duration ?? null,
    });
    if (!availability.ok) {
      return NextResponse.json(
        { error: "Nu am putut citi programul. Încearcă din nou." },
        { status: 503 },
      );
    }
    if (!availability.days.length) {
      return NextResponse.json({
        emptyAvailability: true,
        error: "Nu am găsit locuri libere în următoarele 7 zile. Nu am generat o postare.",
      });
    }
    openSlots = availability.days;
  }

  const providerConfig = getMarketingAIProviderConfig();
  const batchId = crypto.randomUUID();
  const source = utmSourceForChannel(channel);
  const trackedBookingUrl = withMarketingTracking(context.bookingUrl, {
    source,
    batchId,
    appOrigin: getAppUrl(),
  });

  let reservationId: string | null = null;

  try {
    if (providerConfig.provider !== "template") {
      if (!isMarketingAIConfigured()) {
        return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
      }

      const plan = await getCurrentPlan(auth.tenantId);
      const limit = getMarketingAILimitForPlan(plan);
      const reservation = await reserveMarketingAIQuota({
        tenantId: auth.tenantId,
        barberId: resolvedBarber.barberId,
        contentType,
        provider: providerConfig.provider,
        dailyLimit: limit.daily,
        batchId,
        tone: tone ?? "relaxed",
        extraNotes: extraNotes ?? null,
        serviceId: body.serviceId ?? null,
        channel,
      });

      if (reservation.status === "unavailable") {
        return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
      }
      if (reservation.status === "denied") {
        const usage = await getMarketingAIUsageStatus(auth.tenantId);
        return NextResponse.json(
          {
            error: formatMarketingAILimitMessage(
              reservation.used,
              limit.daily ?? reservation.used,
              limit.label,
            ),
            usage,
          },
          { status: 429 },
        );
      }
      reservationId = reservation.id;
    }

    const generated = await generateMarketingContent(context, {
      contentType,
      serviceId: body.serviceId,
      extraNotes,
      tone,
      variantCount: MARKETING_VARIANT_COUNT,
      channel,
      openSlots,
      trackedBookingUrl,
    });

    const countsTowardLimit = shouldCountGeneration({
      provider: providerConfig.provider,
      usedTemplateFallback: Boolean(generated.usedTemplateFallback),
    });

    if (reservationId && !countsTowardLimit) {
      await releaseMarketingAIQuota(reservationId, auth.tenantId);
    }

    await persistMarketingVariants({
      tenantId: auth.tenantId,
      barberId: resolvedBarber.barberId,
      reservationId,
      countsTowardLimit,
      batchId,
      contentType,
      provider: generated.usedTemplateFallback
        ? "template-fallback"
        : providerConfig.provider,
      tone: tone ?? "relaxed",
      extraNotes: extraNotes ?? null,
      serviceId: body.serviceId ?? null,
      channel,
      snapshot: {
        serviceName: selectedService?.name ?? null,
        barberName: context.barberName,
        availability: openSlots ?? null,
      },
      variants: generated.variants,
    });

    const usage = await getMarketingAIUsageStatus(auth.tenantId);

    return NextResponse.json({
      result: generated.result,
      variants: generated.variants,
      batchId,
      contentType,
      channel,
      tone: tone || "relaxed",
      serviceId: body.serviceId ?? null,
      serviceName: selectedService?.name ?? null,
      barberId: resolvedBarber.barberId,
      barberName: context.barberName,
      availability: openSlots ?? null,
      warning: generated.fallbackWarning,
      usedTemplateFallback: generated.usedTemplateFallback ?? false,
      trackedLinks: trackedLinks(context.bookingUrl, batchId),
      usage,
    });
  } catch (error: unknown) {
    if (reservationId) {
      await releaseMarketingAIQuota(reservationId, auth.tenantId);
    }
    const message = error instanceof Error ? error.message : "Eroare la generare";
    console.error("MARKETING AI GENERATE ERROR:", message);
    return NextResponse.json(
      { error: publicGenerateError(message) },
      { status: 500 },
    );
  }
}

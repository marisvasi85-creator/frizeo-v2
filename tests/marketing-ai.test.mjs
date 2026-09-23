import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { resolveMarketingBarberId, serviceBelongsToBarber } from "../lib/marketing-ai/access.ts";
import { getMarketingAILimitForPlan } from "../lib/marketing-ai/limits.ts";
import {
  createQuotaMutex,
  interpretQuotaReservation,
  releaseQuota,
  shouldCountGeneration,
  tryReserveQuota,
} from "../lib/marketing-ai/quota.ts";
import { buildMarketingPrompt } from "../lib/marketing-ai/prompts.ts";
import { generateTemplateVariants } from "../lib/marketing-ai/providers/template.ts";
import { geminiGenerateUrl } from "../lib/marketing-ai/providers/gemini.ts";
import { isSeasonalTypeActive, seasonalWindow } from "../lib/marketing-ai/seasonal.ts";
import { orthodoxEasterDateString } from "../lib/marketing-ai/orthodoxEaster.ts";
import { withMarketingTracking } from "../lib/marketing-ai/tracking.ts";
import {
  applyTextAction,
  asLinkInBio,
  asWhatsApp,
  removeEmoji,
  removePrices,
} from "../lib/marketing-ai/textActions.ts";
import { groupHistoryRows } from "../lib/marketing-ai/historyTypes.ts";
import { countFreeSlotsForDay, summarizeOpenDays } from "../lib/marketing-ai/openSlots.ts";
import { getTodayInBookingTimezone } from "../lib/bookings/bookingTimezone.ts";
import {
  publicGenerateError,
  shouldUseTemplateFallback,
} from "../lib/marketing-ai/providerErrors.ts";
import { MARKETING_CONTENT_TYPES } from "../lib/marketing-ai/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

const context = {
  salonName: "Studio Nord",
  salonDescription: null,
  salonAddress: "Str. Lalelelor 1, Cluj-Napoca",
  cityHint: "Cluj-Napoca",
  barberName: "Andrei",
  barberBio: null,
  barberInstagram: null,
  bookingUrl: "https://frizeo.ro/booking/11111111-1111-4111-8111-111111111111",
  services: [
    {
      id: "svc-1",
      name: "Tuns",
      duration: 30,
      price: 70,
      showPrice: true,
    },
    {
      id: "svc-hidden",
      name: "Pachet",
      duration: 45,
      price: 120,
      showPrice: false,
    },
  ],
};

test("owner and manager can target a requested barber; barber cannot", () => {
  assert.equal(
    resolveMarketingBarberId({
      role: "owner",
      requestedBarberId: "b1",
    }).barberId,
    "b1",
  );
  assert.equal(
    resolveMarketingBarberId({
      role: "manager",
      requestedBarberId: "b2",
    }).barberId,
    "b2",
  );
  const barber = resolveMarketingBarberId({
    role: "barber",
    requestedBarberId: "other",
    currentBarberId: "self",
  });
  assert.equal(barber.barberId, "self");
  assert.equal(
    resolveMarketingBarberId({ role: "barber", currentBarberId: null }).ok,
    false,
  );
  assert.equal(serviceBelongsToBarber(["svc-1"], "svc-1"), true);
  assert.equal(serviceBelongsToBarber(["svc-1"], "other-tenant"), false);
});

test("plan limits stay Free 3, Pro 20, Pro+ 50, trial 50, custom unlimited", () => {
  assert.equal(getMarketingAILimitForPlan({ slug: "free", status: "active" }).daily, 3);
  assert.equal(getMarketingAILimitForPlan({ slug: "pro", status: "active" }).daily, 20);
  assert.equal(getMarketingAILimitForPlan({ slug: "pro-plus", status: "active" }).daily, 50);
  assert.equal(getMarketingAILimitForPlan({ slug: "pro", status: "trialing" }).daily, 50);
  assert.equal(getMarketingAILimitForPlan({ slug: "custom", status: "active" }).daily, null);
  assert.equal(getMarketingAILimitForPlan({ slug: "pro", status: "past_due" }).daily, 3);
});

test("usage date follows Europe/Bucharest, including the midnight boundary", () => {
  assert.equal(getTodayInBookingTimezone(new Date("2026-09-22T20:30:00Z")), "2026-09-22");
  assert.equal(getTodayInBookingTimezone(new Date("2026-09-22T21:30:00Z")), "2026-09-23");
});

test("quota reservation is concurrency-safe and releases on provider fallback", async () => {
  const ledger = { used: 0 };
  const lock = createQuotaMutex();
  const results = await Promise.all(
    Array.from({ length: 20 }, () => lock(() => tryReserveQuota(ledger, 1))),
  );
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(ledger.used, 1);
  releaseQuota(ledger);
  assert.equal(ledger.used, 0);

  const limited = { used: 0 };
  const lock3 = createQuotaMutex();
  const many = await Promise.all(
    Array.from({ length: 30 }, () => lock3(() => tryReserveQuota(limited, 3))),
  );
  assert.equal(many.filter(Boolean).length, 3);

  assert.equal(shouldCountGeneration({ provider: "openai", usedTemplateFallback: false }), true);
  assert.equal(shouldCountGeneration({ provider: "gemini", usedTemplateFallback: true }), false);
  assert.equal(shouldCountGeneration({ provider: "template", usedTemplateFallback: false }), false);
  assert.equal(
    interpretQuotaReservation({ data: null, errorMessage: "Could not find the function" }).status,
    "unavailable",
  );
  assert.equal(
    interpretQuotaReservation({ data: { allowed: false, used: 3 }, errorMessage: null }).status,
    "denied",
  );
});

test("selected service is included for every content type and hidden prices stay hidden", () => {
  for (const contentType of ["instagram_post", "reel", "story", "work_promo", "christmas_promo"]) {
    const prompt = buildMarketingPrompt(context, {
      contentType,
      serviceId: "svc-1",
      channel: "instagram",
    });
    assert.match(prompt, /Tuns/);
    assert.match(prompt, /70 lei/);
  }
  const hidden = buildMarketingPrompt(context, {
    contentType: "instagram_post",
    serviceId: "svc-hidden",
  });
  assert.match(hidden, /prețul nu se publică/);
  assert.doesNotMatch(hidden, /120 lei/);
});

test("template variants are distinct, including season, service, work and open slots", () => {
  const batch = "22222222-2222-4222-8222-222222222222";
  for (const contentType of MARKETING_CONTENT_TYPES) {
    const variants = generateTemplateVariants(context, {
      contentType,
      serviceId: "svc-1",
      channel: contentType === "story" ? "story" : "instagram",
      openSlots:
        contentType === "open_slots"
          ? [{ date: "2026-09-24", weekday: "joi", freeCount: 4, sampleTimes: ["10:00"] }]
          : undefined,
      trackedBookingUrl: `https://frizeo.ro/booking/11111111-1111-4111-8111-111111111111?utm_content=${batch}`,
    });
    assert.equal(variants.length, 3);
    const contents = new Set(variants.map((item) => item.content));
    assert.equal(contents.size, 3, contentType);
  }
});

test("work promo does not invent a haircut unless the notes say so", () => {
  const plain = generateTemplateVariants(context, {
    contentType: "work_promo",
    channel: "instagram",
  });
  for (const variant of plain) {
    assert.doesNotMatch(variant.content, /fade|taper|buzz|undercut/i);
  }
  const noted = generateTemplateVariants(context, {
    contentType: "work_promo",
    extraNotes: "burst fade",
    channel: "instagram",
  });
  assert.match(noted[0].content, /burst fade/);
});

test("open slot copy uses only the aggregated days", () => {
  const variants = generateTemplateVariants(context, {
    contentType: "open_slots",
    channel: "whatsapp",
    openSlots: [{ date: "2026-09-24", weekday: "joi", freeCount: 4, sampleTimes: ["10:00"] }],
    trackedBookingUrl: "https://frizeo.ro/booking/11111111-1111-4111-8111-111111111111?utm_source=whatsapp",
  });
  for (const variant of variants) {
    assert.match(variant.content, /joi/);
    assert.doesNotMatch(variant.content, /luni|ultimele locuri/i);
  }
  assert.match(variants[0].callToAction, /https:\/\/frizeo\.ro\/booking\//);
});

test("Orthodox Easter 2027 is in May and the promo window opens before it", () => {
  assert.equal(orthodoxEasterDateString(2024), "2024-05-05");
  assert.equal(orthodoxEasterDateString(2025), "2025-04-20");
  assert.equal(orthodoxEasterDateString(2026), "2026-04-12");
  assert.equal(orthodoxEasterDateString(2027), "2027-05-02");
  assert.equal(isSeasonalTypeActive("easter_promo", new Date("2027-03-01T12:00:00Z")), false);
  assert.equal(isSeasonalTypeActive("easter_promo", new Date("2027-04-20T12:00:00Z")), true);
  assert.equal(isSeasonalTypeActive("easter_promo", new Date("2027-05-02T12:00:00Z")), true);
  const window = seasonalWindow("easter_promo", "2027-04-20");
  assert.ok(window.start <= "2027-04-20");
  assert.ok(window.end >= "2027-05-02");
});

test("history groups a batch and keeps the original tone", () => {
  const batches = groupHistoryRows([
    {
      id: "row-b",
      content_type: "instagram_post",
      provider: "openai",
      created_at: "2026-09-23T10:00:02Z",
      title: "B",
      content: "second",
      hashtags: [],
      call_to_action: "Link în bio",
      barber_id: "b1",
      tone: "street",
      extra_notes: "cafea",
      service_id: "svc-1",
      channel: "instagram",
      variant_index: 1,
      generation_batch_id: "batch-1",
      context_snapshot: { serviceName: "Tuns", barberName: "Andrei" },
    },
    {
      id: "row-a",
      content_type: "instagram_post",
      provider: "openai",
      created_at: "2026-09-23T10:00:01Z",
      title: "A",
      content: "first",
      hashtags: ["frizerie"],
      call_to_action: "Link în bio",
      barber_id: "b1",
      tone: "street",
      extra_notes: "cafea",
      service_id: "svc-1",
      channel: "instagram",
      variant_index: 0,
      generation_batch_id: "batch-1",
      context_snapshot: { serviceName: "Tuns", barberName: "Andrei" },
    },
    {
      id: "legacy",
      content_type: "reel",
      provider: "template",
      created_at: "2026-09-01T10:00:00Z",
      title: "Vechi",
      content: "fara metadata",
      hashtags: [],
      call_to_action: "Programează-te",
      barber_id: "b1",
    },
  ]);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].tone, "street");
  assert.equal(batches[0].extraNotes, "cafea");
  assert.equal(batches[0].serviceName, "Tuns");
  assert.equal(batches[0].variants.length, 2);
  assert.equal(batches[0].variants[0].variantIndex, 0);
  assert.equal(batches[1].tone, null);
  assert.equal(batches[1].id, "legacy");
});

test("local quick actions do not call a provider", () => {
  const draft = {
    title: "Titlu ✂️",
    content: "Tuns de la 70 lei. https://frizeo.ro/booking/x",
    hashtags: [],
    callToAction: "70 lei aici",
  };
  assert.doesNotMatch(removePrices(draft).content, /70/);
  assert.doesNotMatch(removeEmoji(draft).title, /✂/);
  assert.match(asLinkInBio(draft, "https://frizeo.ro/booking/x").callToAction, /Link în bio/);
  assert.doesNotMatch(asLinkInBio(draft, "https://frizeo.ro/booking/x").content, /https:/);
  assert.match(
    asWhatsApp(draft, "https://frizeo.ro/booking/x?utm_source=whatsapp").callToAction,
    /utm_source=whatsapp/,
  );
  assert.equal(applyTextAction("unknown", draft), null);
});

test("tracking params stay on the booking URL and reject open redirects", () => {
  const batch = "33333333-3333-4333-8333-333333333333";
  const tracked = withMarketingTracking(
    "https://frizeo.ro/booking/11111111-1111-4111-8111-111111111111",
    { source: "instagram", batchId: batch, appOrigin: "https://frizeo.ro" },
  );
  const url = new URL(tracked);
  assert.equal(url.searchParams.get("utm_source"), "instagram");
  assert.equal(url.searchParams.get("utm_medium"), "social");
  assert.equal(url.searchParams.get("utm_campaign"), "marketing_ai");
  assert.equal(url.searchParams.get("utm_content"), batch);
  assert.equal(url.pathname, "/booking/11111111-1111-4111-8111-111111111111");
  assert.equal(
    withMarketingTracking("https://evil.example/booking/x", {
      source: "instagram",
      batchId: batch,
      appOrigin: "https://frizeo.ro",
    }),
    null,
  );
  assert.equal(
    withMarketingTracking("javascript:alert(1)", {
      source: "instagram",
      batchId: batch,
    }),
    null,
  );
  assert.equal(
    withMarketingTracking("https://frizeo.ro/admin", {
      source: "instagram",
      batchId: batch,
    }),
    null,
  );
  assert.equal(
    withMarketingTracking("https://frizeo.ro/booking/x", {
      source: "not-a-source",
      batchId: batch,
    }),
    null,
  );
  assert.equal(
    withMarketingTracking("https://frizeo.ro/booking/x", {
      source: "qr",
      batchId: "not-a-uuid",
    }),
    null,
  );
});

test("availability respects schedule, closures, bookings and does not invent days", () => {
  const base = {
    date: "2026-09-24",
    scheduleMode: "weekly",
    weekly: {
      day_of_week: 4,
      is_working: true,
      work_start: "09:00",
      work_end: "11:00",
      break_enabled: false,
      break_start: null,
      break_end: null,
    },
    override: null,
    bookings: [],
    googleBusy: [],
    durationMinutes: 30,
    minNoticeHours: 0,
    now: new Date("2026-09-24T05:00:00Z"),
  };
  assert.equal(countFreeSlotsForDay(base).freeCount, 4);
  assert.equal(
    countFreeSlotsForDay({
      ...base,
      override: { is_closed: true },
    }).freeCount,
    0,
  );
  assert.equal(
    countFreeSlotsForDay({
      ...base,
      bookings: [
        {
          id: "booking-1",
          start_time: "09:00",
          end_time: "11:00",
          status: "confirmed",
        },
      ],
    }).freeCount,
    0,
  );
  assert.equal(
    countFreeSlotsForDay({
      ...base,
      scheduleMode: "selective",
    }).freeCount,
    0,
  );
  const summary = summarizeOpenDays([
    base,
    { ...base, date: "2026-09-25", override: { is_closed: true } },
  ]);
  assert.deepEqual(summary.map((day) => day.date), ["2026-09-24"]);
});

test("provider errors stay user-facing and Gemini is not called with the key in the URL", () => {
  const url = geminiGenerateUrl("gemini-3.1-flash-lite");
  assert.equal(url.includes("key="), false);
  assert.equal(url.includes("AIza"), false);
  const geminiSource = read("lib/marketing-ai/providers/gemini.ts");
  assert.equal(geminiSource.includes("?key="), false);
  assert.match(geminiSource, /x-goog-api-key/);
  assert.equal(shouldUseTemplateFallback("The operation was aborted due to timeout"), true);
  const hidden = publicGenerateError("Invalid GEMINI_API_KEY sk-test AIzaSySecret");
  assert.equal(hidden.includes("AIza"), false);
  assert.equal(hidden.includes("sk-"), false);
  assert.equal(hidden.includes("GEMINI_API_KEY"), false);
});

test("page load, history and slots stay on demand", () => {
  const page = read("app/admin/marketing-ai/page.tsx");
  const client = read("app/admin/marketing-ai/MarketingAIClient.tsx");
  const route = read("app/api/marketing-ai/generate/route.ts");
  const migration = read("supabase/migrations/20260923120000_marketing_ai_batch_quota.sql");
  assert.equal(page.includes("generateMarketingContent"), false);
  assert.equal(page.includes("diagnostics"), false);
  assert.equal(page.includes("GEMINI_API_KEY"), false);
  assert.equal(client.includes("GEMINI_API_KEY"), false);
  assert.equal(client.includes("Vercel"), false);
  assert.equal(client.split("/api/marketing-ai/generate").length, 2);
  assert.match(route, /contentType === "open_slots"/);
  assert.match(route, /reserveMarketingAIQuota/);
  assert.equal(route.includes("setInterval"), false);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.equal(migration.includes("DELETE "), false);
  assert.equal(migration.includes("DROP "), false);
  const cronDir = read("app/api/cron/booking-notifications/route.ts");
  assert.equal(cronDir.includes("marketing-ai"), false);
});

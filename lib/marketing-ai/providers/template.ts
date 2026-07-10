import type {
  GenerateMarketingInput,
  GenerateMarketingResult,
  MarketingContentType,
  MarketingContext,
} from "../types";
import type { MarketingAIProvider } from "./types";

function pickService(context: MarketingContext, serviceId?: string) {
  if (serviceId) {
    return context.services.find((service) => service.id === serviceId) || null;
  }
  return context.services[0] || null;
}

function baseHashtags(context: MarketingContext) {
  const salonTag = context.salonName
    .toLowerCase()
    .replace(/[^a-z0-9ăâîșț ]/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("");

  return [
    "frizerie",
    "barbershop",
    "programareonline",
    salonTag || "frizeo",
    context.barberName.toLowerCase().replace(/\s+/g, ""),
  ].filter(Boolean);
}

function buildByType(
  context: MarketingContext,
  input: GenerateMarketingInput,
): GenerateMarketingResult {
  const service = pickService(context, input.serviceId);
  const serviceLine = service
    ? `${service.name} (${service.duration} min)`
    : "serviciile noastre";
  const extra = input.extraNotes?.trim() ? `\n\n${input.extraNotes.trim()}` : "";

  const builders: Record<MarketingContentType, () => GenerateMarketingResult> = {
    instagram_post: () => ({
      title: "Postare Instagram",
      content: `✂️ La ${context.salonName}, look-ul tău e pe mâini bune.\n\nCu ${context.barberName}, primești servicii de calitate — de la ${serviceLine} și multe altele. Stil curat, atmosferă relaxată, rezultat care ți se potrivește.${extra}`,
      hashtags: baseHashtags(context),
      callToAction: `Programează-te în 30 de secunde: ${context.bookingUrl}`,
    }),
    reel: () => ({
      title: "Script Reel",
      content: `[SCENĂ 1 — 3 sec] Close-up foarfecă + text: „Îți schimbi look-ul azi?”\n[SCENĂ 2 — 10 sec] Transformare rapidă în scaun, cu ${context.barberName}\n[SCENĂ 3 — 10 sec] Rezultat final + overlay: „${serviceLine}”\n[SCENĂ 4 — 5 sec] Logo ${context.salonName} + link programări${extra}`,
      hashtags: [...baseHashtags(context), "reels", "transformation"],
      callToAction: `Rezervă acum: ${context.bookingUrl}`,
    }),
    story: () => ({
      title: "Story Instagram",
      content: `Slide 1: Locuri libere la ${context.salonName} ✂️\nSlide 2: Recomandarea zilei — ${serviceLine}\nSlide 3: Tap pe link → programează-te în câteva secunde${extra}`,
      hashtags: baseHashtags(context),
      callToAction: `Link în bio / story: ${context.bookingUrl}`,
    }),
    christmas_promo: () => ({
      title: "Promoție Crăciun",
      content: `🎄 Sărbători cu stil la ${context.salonName}!\n\nPregătește-te pentru petreceri cu un look impecabil. ${context.barberName} te așteaptă cu programări rapide și servicii de top — inclusiv ${serviceLine}.\n\n🎁 Ofertă specială de sezon pentru clienții care programează online.${extra}`,
      hashtags: [...baseHashtags(context), "craciun", "sarbatori"],
      callToAction: `Programează-te online: ${context.bookingUrl}`,
    }),
    service_promo: () => ({
      title: service ? `Promovare ${service.name}` : "Promovare serviciu",
      content: service
        ? `💈 ${service.name} — ${service.duration} min\n\nLa ${context.salonName}, ${context.barberName} îți oferă exact ce ai nevoie: tehnică, atenție la detalii și un rezultat care arată fresh mult timp.${extra}`
        : `💈 Descoperă serviciile noastre la ${context.salonName}. Programează-te ușor online cu ${context.barberName}.${extra}`,
      hashtags: baseHashtags(context),
      callToAction: `Rezervă ${service?.name || "serviciul"}: ${context.bookingUrl}`,
    }),
    birthday_offer: () => ({
      title: "Ofertă aniversare",
      content: `🎂 ${context.salonName} sărbătorește — și te răsplătește!\n\nÎn această perioadă, clienții care programează online primesc o surpriză specială la vizită. ${context.barberName} te așteaptă cu ${serviceLine} și multe altele.${extra}`,
      hashtags: [...baseHashtags(context), "aniversare", "oferta"],
      callToAction: `Profită acum — locuri limitate: ${context.bookingUrl}`,
    }),
  };

  return builders[input.contentType]();
}

export function generateTemplateContent(
  context: MarketingContext,
  input: GenerateMarketingInput,
): GenerateMarketingResult {
  return buildByType(context, input);
}

export function createTemplateProvider(): MarketingAIProvider {
  return {
    id: "template",
    isConfigured() {
      return true;
    },
    async complete() {
      throw new Error("Template provider folosește generateTemplateContent direct.");
    },
  };
}

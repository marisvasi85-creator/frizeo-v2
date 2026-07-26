import type {
  GenerateMarketingInput,
  GenerateMarketingResult,
  MarketingContentType,
  MarketingContext,
  MarketingTone,
} from "../types";
import { MARKETING_VARIANT_COUNT } from "../types";
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

  const cityTag = context.cityHint
    ? context.cityHint.toLowerCase().replace(/[^a-z0-9ăâîșț]/gi, "")
    : null;

  return [
    "frizerie",
    "barbershop",
    "programareonline",
    salonTag || "frizeo",
    cityTag,
    context.barberName.toLowerCase().replace(/\s+/g, ""),
  ].filter(Boolean) as string[];
}

function tonePrefix(tone: MarketingTone | undefined): string {
  if (tone === "premium") return "Experiență atentă la detalii. ";
  if (tone === "street") return "Fresh cut. Zero compromis. ";
  return "";
}

function buildByType(
  context: MarketingContext,
  input: GenerateMarketingInput,
  variantIndex: number,
): GenerateMarketingResult {
  const service = pickService(context, input.serviceId);
  const serviceLine = service
    ? `${service.name} (${service.duration} min)`
    : "serviciile noastre";
  const priceLine =
    service?.showPrice && service.price != null ? ` de la ${service.price} lei` : "";
  const extra = input.extraNotes?.trim()
    ? `\n\n${input.extraNotes.trim().slice(0, 200)}`
    : "";
  const prefix = tonePrefix(input.tone);
  const hooks = [
    "Îți schimbi look-ul azi?",
    "Calendarul se umple — tu ai loc rezervat?",
    "Un fade bun începe cu o programare bună.",
  ];
  const hook = hooks[variantIndex % hooks.length];
  const cityBit = context.cityHint ? ` în ${context.cityHint}` : "";

  const builders: Record<MarketingContentType, () => GenerateMarketingResult> = {
    instagram_post: () => ({
      title: variantIndex === 0 ? "Postare Instagram" : `Postare Instagram ${variantIndex + 1}`,
      content: `${prefix}${hook}\n\nLa ${context.salonName}${cityBit}, ${context.barberName} are grijă de ${serviceLine}${priceLine}. Stil curat, atmosferă bună, rezultat care ți se potrivește.${extra}`,
      hashtags: baseHashtags(context),
      callToAction: `Programează-te online: ${context.bookingUrl}`,
    }),
    reel: () => ({
      title: variantIndex === 0 ? "Script Reel" : `Script Reel ${variantIndex + 1}`,
      content: `[SCENĂ 1 — 3 sec] Close-up foarfecă + text: „${hook}”\n[SCENĂ 2 — 10 sec] Transformare rapidă cu ${context.barberName}\n[SCENĂ 3 — 10 sec] Rezultat final + overlay: „${serviceLine}”\n[SCENĂ 4 — 5 sec] Logo ${context.salonName} + link programări${extra}`,
      hashtags: [...baseHashtags(context), "reels", "transformation"],
      callToAction: `Rezervă acum: ${context.bookingUrl}`,
    }),
    story: () => ({
      title: variantIndex === 0 ? "Story Instagram" : `Story Instagram ${variantIndex + 1}`,
      content: `Slide 1: ${hook}\nSlide 2: ${serviceLine} la ${context.salonName}\nSlide 3: Tap pe link → programează-te în câteva secunde${extra}`,
      hashtags: baseHashtags(context),
      callToAction: `Link programări: ${context.bookingUrl}`,
    }),
    christmas_promo: () => ({
      title: "Promoție Crăciun",
      content: `🎄 Sărbători cu stil la ${context.salonName}!\n\n${prefix}Pregătește-te pentru petreceri cu un look impecabil. ${context.barberName} te așteaptă cu ${serviceLine}.\n\nOfertă specială de sezon pentru cine programează online.${extra}`,
      hashtags: [...baseHashtags(context), "craciun", "sarbatori"],
      callToAction: `Programează-te online: ${context.bookingUrl}`,
    }),
    service_promo: () => ({
      title: service ? `Promovare ${service.name}` : "Promovare serviciu",
      content: service
        ? `💈 ${service.name} — ${service.duration} min${priceLine}\n\n${prefix}La ${context.salonName}, ${context.barberName} îți oferă tehnică, atenție la detalii și un rezultat care arată fresh mult timp.${extra}`
        : `💈 Descoperă serviciile noastre la ${context.salonName}. Programează-te ușor online.${extra}`,
      hashtags: baseHashtags(context),
      callToAction: `Rezervă ${service?.name || "serviciul"}: ${context.bookingUrl}`,
    }),
    birthday_offer: () => ({
      title: "Ofertă aniversare",
      content: `🎂 ${context.salonName} sărbătorește — și te răsplătește!\n\n${prefix}Clienții care programează online primesc o surpriză specială la vizită. ${context.barberName} te așteaptă cu ${serviceLine}.${extra}`,
      hashtags: [...baseHashtags(context), "aniversare", "oferta"],
      callToAction: `Profită acum — locuri limitate: ${context.bookingUrl}`,
    }),
    easter_promo: () => ({
      title: "Promoție Paște",
      content: `🐣 Paște cu look proaspăt la ${context.salonName}.\n\n${prefix}${context.barberName} te pregătește cu ${serviceLine} — rapid, curat, gata de sărbători.${extra}`,
      hashtags: [...baseHashtags(context), "paste", "lookfresh"],
      callToAction: `Rezervă din timp: ${context.bookingUrl}`,
    }),
    black_friday: () => ({
      title: "Black Friday",
      content: `🖤 Black Friday la ${context.salonName}.\n\n${prefix}${hook} Programează online ${serviceLine} și prinde loc înainte să se umple agenda.${extra}`,
      hashtags: [...baseHashtags(context), "blackfriday", "oferta"],
      callToAction: `Rezervă acum: ${context.bookingUrl}`,
    }),
    back_to_school: () => ({
      title: "Back to school",
      content: `🎒 Back to school / birou — look fresh la ${context.salonName}.\n\n${prefix}${context.barberName} te așteaptă cu ${serviceLine}. Programează-te online și începe sezonul cum trebuie.${extra}`,
      hashtags: [...baseHashtags(context), "backtoschool", "fade"],
      callToAction: `Programează-te: ${context.bookingUrl}`,
    }),
  };

  return builders[input.contentType]();
}

export function generateTemplateContent(
  context: MarketingContext,
  input: GenerateMarketingInput,
): GenerateMarketingResult {
  return buildByType(context, input, 0);
}

export function generateTemplateVariants(
  context: MarketingContext,
  input: GenerateMarketingInput,
): GenerateMarketingResult[] {
  const count = Math.min(
    Math.max(input.variantCount ?? MARKETING_VARIANT_COUNT, 1),
    MARKETING_VARIANT_COUNT,
  );
  return Array.from({ length: count }, (_, index) =>
    buildByType(context, input, index),
  );
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

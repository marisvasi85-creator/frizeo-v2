import type { MarketingChannel } from "../channels";
import { openSlotTemplateLine } from "../openSlotCopy";
import { ctaForChannel } from "../textActions";
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

function tonePrefix(tone: MarketingTone | undefined, variantIndex: number): string {
  if (tone === "premium") {
    return ["Experiență atentă la detalii. ", "Fără grabă, cu precizie. ", "Un rezultat curat, lucrat pe îndelete. "][
      variantIndex % 3
    ];
  }
  if (tone === "street") {
    return ["Fresh cut. ", "Zero compromis. ", "Look nou, fără poveste lungă. "][variantIndex % 3];
  }
  return ["", "Pe scurt: ", "Direct: "][variantIndex % 3];
}

function cta(context: MarketingContext, input: GenerateMarketingInput): string {
  const channel = (input.channel || "instagram") as MarketingChannel;
  return ctaForChannel(channel, input.trackedBookingUrl || null);
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
  const prefix = tonePrefix(input.tone, variantIndex);
  const hooks = [
    "Îți schimbi look-ul azi?",
    "Programarea se face în câteva secunde.",
    `${context.barberName} te așteaptă — tu alegi ora.`,
  ];
  const hook = hooks[variantIndex % hooks.length];
  const cityBit = context.cityHint ? ` în ${context.cityHint}` : "";
  const action = cta(context, input);
  const slotLine = openSlotTemplateLine(input.openSlots || []);

  const serviceAngles = service
    ? [
        `💈 ${service.name} — ${service.duration} min${priceLine}. ${prefix}La ${context.salonName}, ${context.barberName} îl face pe îndelete.`,
        `${service.name} la ${context.barberName}. ${service.duration} min${priceLine}, fără pași în plus: alegi ora și vii.`,
        `Dacă vrei ${service.name.toLowerCase()}, ${context.salonName}${cityBit} îl are în program. ${service.duration} min${priceLine}.`,
      ]
    : [
        `Descoperă serviciile de la ${context.salonName}.`,
        `${context.barberName} lucrează la ${context.salonName}.`,
        `Alege serviciul și ora, direct din pagina de programări.`,
      ];

  const builders: Record<MarketingContentType, () => GenerateMarketingResult> = {
    instagram_post: () => ({
      title: variantIndex === 0 ? "Postare" : `Postare ${variantIndex + 1}`,
      content: [
        `${prefix}${hook}\n\nLa ${context.salonName}${cityBit}, ${context.barberName} are grijă de ${serviceLine}${priceLine}.`,
        `${prefix}Trece pe la ${context.salonName}. ${context.barberName} lucrează ${serviceLine}${priceLine}.`,
        `${hook}\n\n${serviceLine} cu ${context.barberName}, la ${context.salonName}${cityBit}.`,
      ][variantIndex % 3] + extra,
      hashtags: baseHashtags(context),
      callToAction: action,
    }),
    reel: () => ({
      title: variantIndex === 0 ? "Script Reel" : `Script Reel ${variantIndex + 1}`,
      content: [
        `[SCENĂ 1] „${hook}”\n[SCENĂ 2] ${context.barberName} la lucru\n[SCENĂ 3] ${serviceLine}\n[SCENĂ 4] ${action}`,
        `[SCENĂ 1] „${context.salonName}”\n[SCENĂ 2] ${serviceLine}\n[SCENĂ 3] Detaliu final\n[SCENĂ 4] ${action}`,
        `[SCENĂ 1] „${context.barberName}”\n[SCENĂ 2] ${hook}\n[SCENĂ 3] ${serviceLine}\n[SCENĂ 4] ${action}`,
      ][variantIndex % 3] + extra,
      hashtags: [...baseHashtags(context), "reels"],
      callToAction: action,
    }),
    story: () => ({
      title: variantIndex === 0 ? "Story" : `Story ${variantIndex + 1}`,
      content: `Slide 1: ${hook}\nSlide 2: ${serviceLine} la ${context.salonName}\nSlide 3: ${action}${extra}`,
      hashtags: baseHashtags(context),
      callToAction: action,
    }),
    christmas_promo: () => ({
      title: `Crăciun ${variantIndex + 1}`,
      content: [
        `🎄 Sărbători la ${context.salonName}. ${prefix}${context.barberName} te pregătește cu ${serviceLine}.`,
        `Cadoul de look: ${serviceLine} la ${context.salonName}. ${prefix}Rezervă înainte de aglomerația de decembrie.`,
        `${context.barberName} ține locuri pentru sărbători. ${serviceLine}, la ${context.salonName}${cityBit}.`,
      ][variantIndex % 3] + extra,
      hashtags: [...baseHashtags(context), "craciun"],
      callToAction: action,
    }),
    service_promo: () => ({
      title: service ? `${service.name} ${variantIndex + 1}` : `Serviciu ${variantIndex + 1}`,
      content: `${serviceAngles[variantIndex % 3]}${extra}`,
      hashtags: baseHashtags(context),
      callToAction: action,
    }),
    birthday_offer: () => ({
      title: `Aniversare ${variantIndex + 1}`,
      content: [
        `🎂 ${context.salonName} își serbează aniversarea. ${prefix}${context.barberName} te așteaptă cu ${serviceLine}.`,
        `Zi de salon la ${context.salonName}. ${serviceLine}, cu ${context.barberName}.`,
        `Aniversăm ${context.salonName}. Vii la ${serviceLine}? ${prefix}`,
      ][variantIndex % 3] + extra,
      hashtags: [...baseHashtags(context), "aniversare"],
      callToAction: action,
    }),
    easter_promo: () => ({
      title: `Paște ${variantIndex + 1}`,
      content: [
        `🐣 Paște cu look proaspăt la ${context.salonName}. ${prefix}${context.barberName} te pregătește cu ${serviceLine}.`,
        `Înainte de Paște, ${serviceLine} la ${context.barberName}. ${context.salonName}${cityBit}.`,
        `Look de sărbătoare, fără grabă de ultim moment: ${serviceLine} la ${context.salonName}.`,
      ][variantIndex % 3] + extra,
      hashtags: [...baseHashtags(context), "paste"],
      callToAction: action,
    }),
    black_friday: () => ({
      title: `Black Friday ${variantIndex + 1}`,
      content: [
        `🖤 Black Friday la ${context.salonName}. ${prefix}${hook} ${serviceLine}.`,
        `Agenda de Black Friday la ${context.barberName}: ${serviceLine}.`,
        `${context.salonName} deschide programările de Black Friday pentru ${serviceLine}.`,
      ][variantIndex % 3] + extra,
      hashtags: [...baseHashtags(context), "blackfriday"],
      callToAction: action,
    }),
    back_to_school: () => ({
      title: `Back to school ${variantIndex + 1}`,
      content: [
        `🎒 Început de sezon la ${context.salonName}. ${prefix}${context.barberName} te așteaptă cu ${serviceLine}.`,
        `Look pentru școală sau birou: ${serviceLine}, la ${context.salonName}.`,
        `${context.barberName} pregătește ${serviceLine} înainte să se umple săptămâna.`,
      ][variantIndex % 3] + extra,
      hashtags: [...baseHashtags(context), "backtoschool"],
      callToAction: action,
    }),
    work_promo: () => ({
      title: `Lucrare ${variantIndex + 1}`,
      content: [
        `Lucrare nouă la ${context.salonName}. ${prefix}${context.barberName} a terminat acum${service ? ` — ${service.name}` : ""}.`,
        `Rezultat proaspăt, gata de arătat. ${context.barberName}${service ? `, ${service.name}` : ""} la ${context.salonName}.`,
        `Încă o lucrare făcută de ${context.barberName}${cityBit}. ${service ? service.name + ". " : ""}Fără detalii în plus față de ce vezi în poză.`,
      ][variantIndex % 3] + extra,
      hashtags: baseHashtags(context),
      callToAction: action,
    }),
    open_slots: () => ({
      title: `Locuri libere ${variantIndex + 1}`,
      content: slotLine
        ? [
            `Mai sunt locuri disponibile: ${slotLine}.`,
            `În programul lui ${context.barberName} sunt locuri: ${slotLine}.`,
            `Dacă vrei să treci pe la ${context.salonName}: ${slotLine}.`,
          ][variantIndex % 3] + extra
        : `Nu am o listă confirmată de locuri libere pentru ${context.barberName}.`,
      hashtags: baseHashtags(context),
      callToAction: action,
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

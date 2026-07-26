import type {
  GenerateMarketingInput,
  MarketingContentType,
  MarketingContext,
  MarketingTone,
} from "./types";
import { MARKETING_EXTRA_NOTES_MAX, MARKETING_VARIANT_COUNT } from "./types";

const CONTENT_LABELS: Record<MarketingContentType, string> = {
  instagram_post: "postare Instagram",
  reel: "script pentru Reel Instagram/TikTok",
  story: "text pentru Story Instagram",
  christmas_promo: "promoție de Crăciun",
  service_promo: "promovare serviciu",
  birthday_offer: "ofertă de aniversare salon",
  easter_promo: "promoție de Paște",
  black_friday: "promoție Black Friday",
  back_to_school: "campanie back to school",
};

const TONE_INSTRUCTIONS: Record<MarketingTone, string> = {
  relaxed:
    "Ton relaxat, prietenos, conversațional — ca un mesaj de la frizerul din cartier.",
  premium:
    "Ton premium, elegant, precis — fără slang, fără emoji excesive, accent pe calitate și detalii.",
  street:
    "Ton street / modern barbershop — energic, scurt, cu ritm; poți folosi limbaj urban moderat, fără vulgarități.",
};

const LENGTH_RULES: Record<MarketingContentType, string> = {
  instagram_post: "content: 400–900 caractere (ideal sub 1200).",
  reel: "content: script 30–45s, max ~900 caractere.",
  story: "content: 2–3 slide-uri, max 2 rânduri fiecare, total sub 400 caractere.",
  christmas_promo: "content: 350–800 caractere.",
  service_promo: "content: 300–700 caractere.",
  birthday_offer: "content: 300–700 caractere.",
  easter_promo: "content: 350–800 caractere.",
  black_friday: "content: 300–700 caractere, urgență clară dar fără spam.",
  back_to_school: "content: 300–700 caractere.",
};

function formatServicesList(context: MarketingContext) {
  if (!context.services.length) return "Nu sunt servicii listate.";

  return context.services
    .map((service) => {
      const price =
        service.showPrice && service.price != null
          ? ` — ${service.price} lei`
          : "";
      return `- ${service.name} (${service.duration} min)${price}`;
    })
    .join("\n");
}

function formatSalonBlock(context: MarketingContext) {
  return [
    `Salon: ${context.salonName}`,
    context.salonDescription ? `Descriere salon: ${context.salonDescription}` : null,
    context.salonAddress ? `Adresă: ${context.salonAddress}` : null,
    context.cityHint ? `Oraș (pentru hashtag-uri): ${context.cityHint}` : null,
    `Frizer: ${context.barberName}`,
    context.barberBio ? `Bio frizer: ${context.barberBio}` : null,
    context.barberInstagram ? `Instagram: ${context.barberInstagram}` : null,
    `Link programări: ${context.bookingUrl}`,
    `Servicii:\n${formatServicesList(context)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function sanitizeExtraNotes(notes?: string): string | null {
  const trimmed = notes?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MARKETING_EXTRA_NOTES_MAX);
}

export function buildMarketingPrompt(
  context: MarketingContext,
  input: GenerateMarketingInput,
) {
  const label = CONTENT_LABELS[input.contentType];
  const selectedService = input.serviceId
    ? context.services.find((service) => service.id === input.serviceId)
    : null;
  const tone: MarketingTone = input.tone || "relaxed";
  const variantCount = Math.min(
    Math.max(input.variantCount ?? MARKETING_VARIANT_COUNT, 1),
    MARKETING_VARIANT_COUNT,
  );

  const typeInstructions: Record<MarketingContentType, string> = {
    instagram_post:
      "Scrie o postare Instagram captivantă. Include un hook la început, beneficii clare și invitație la programare.",
    reel:
      "Scrie un script scurt pentru Reel (30-45 secunde): hook în primele 3 secunde, 3 scene/idei vizuale marcate ca [SCENĂ 1], [SCENĂ 2], text voiceover și CTA final.",
    story:
      "Scrie 2-3 slide-uri scurte pentru Story (max 2 rânduri fiecare), cu emoji discrete. Ultimul slide trebuie să aibă CTA clar spre programare.",
    christmas_promo:
      "Scrie o promoție de Crăciun/sărbători pentru salon: ofertă specială plauzibilă, urgență blândă, ton festiv dar profesionist.",
    service_promo: selectedService
      ? `Promovează serviciul „${selectedService.name}” (${selectedService.duration} min${
          selectedService.showPrice && selectedService.price != null
            ? `, ${selectedService.price} lei`
            : ""
        }). Evidențiază pentru cine e potrivit și de ce merită rezervat acum.`
      : "Promovează un serviciu principal din listă.",
    birthday_offer:
      "Scrie o ofertă de aniversare a salonului (ex. reducere sau beneficiu extra la programare). Ton celebrativ, exclusivitate, limitare în timp.",
    easter_promo:
      "Scrie o promoție de Paște: look proaspăt pentru sărbători, ton cald, fără a inventa reduceri concrete.",
    black_friday:
      "Scrie o campanie Black Friday pentru frizerie: urgență reală, beneficiu clar, fără agresivitate de discount inventat.",
    back_to_school:
      "Scrie o campanie back-to-school / început de toamnă: look fresh pentru școală/birou, ton energic și practic.",
  };

  const extra = sanitizeExtraNotes(input.extraNotes);
  const extraBlock = extra
    ? `\nNote suplimentare de la frizer (respectă-le dacă nu contrazic regulile): ${extra}`
    : "";

  const cityHashtagRule = context.cityHint
    ? `- Include hashtag cu orașul „${context.cityHint}” (ex. #${context.cityHint.replace(/\s+/g, "")}) unde e natural`
    : "- Dacă apare un oraș în adresă, folosește-l în hashtag-uri";

  return `Ești copywriter pentru frizerii din România. Generează ${variantCount} variante DISTINCTE de conținut de marketing în limba română pentru: ${label}.

DATE SALON:
${formatSalonBlock(context)}

TON:
${TONE_INSTRUCTIONS[tone]}

INSTRUCȚIUNI TIP CONȚINUT:
${typeInstructions[input.contentType]}

LUNGIME:
${LENGTH_RULES[input.contentType]}

REGULI:
- Variantele trebuie să difere ca hook și formulare, nu doar să schimbe 2 cuvinte
- Scrie natural, fără clișee exagerate
- Folosește diacritice românești
- Nu inventa prețuri sau reduceri concrete dacă nu sunt în date; poți folosi formulări gen „ofertă specială” sau „surpriză la programare”
- Dacă serviciul are preț afișat în date, poți menționa prețul; altfel nu inventa
- Include mereu un call-to-action spre linkul de programare
- Hashtag-urile trebuie relevante pentru România (frizerie, barbershop)
${cityHashtagRule}
- title: max 60 caractere
- callToAction: max 120 caractere
- Răspunde DOAR cu JSON valid, fără markdown, în formatul:
{"variants":[{"title":"titlu scurt","content":"textul principal","hashtags":["tag1","tag2"],"callToAction":"propoziție CTA"}]}
- Array-ul "variants" trebuie să aibă exact ${variantCount} obiecte${extraBlock}`;
}

import type {
  GenerateMarketingInput,
  MarketingContentType,
  MarketingContext,
} from "./types";

const CONTENT_LABELS: Record<MarketingContentType, string> = {
  instagram_post: "postare Instagram",
  reel: "script pentru Reel Instagram/TikTok",
  story: "text pentru Story Instagram",
  christmas_promo: "promoție de Crăciun",
  service_promo: "promovare serviciu",
  birthday_offer: "ofertă de aniversare salon",
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
    `Frizer: ${context.barberName}`,
    context.barberBio ? `Bio frizer: ${context.barberBio}` : null,
    context.barberInstagram ? `Instagram: ${context.barberInstagram}` : null,
    `Link programări: ${context.bookingUrl}`,
    `Servicii:\n${formatServicesList(context)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildMarketingPrompt(
  context: MarketingContext,
  input: GenerateMarketingInput,
) {
  const label = CONTENT_LABELS[input.contentType];
  const selectedService = input.serviceId
    ? context.services.find((service) => service.id === input.serviceId)
    : null;

  const typeInstructions: Record<MarketingContentType, string> = {
    instagram_post:
      "Scrie o postare Instagram captivantă, cu ton prietenos și profesionist. Include un hook la început, beneficii clare și invitație la programare.",
    reel:
      "Scrie un script scurt pentru Reel (30-45 secunde): hook în primele 3 secunde, 3 scene/idei vizuale marcate ca [SCENĂ 1], [SCENĂ 2], text voiceover și CTA final.",
    story:
      "Scrie 2-3 slide-uri scurte pentru Story (max 2 rânduri fiecare), cu emoji discrete. Ultimul slide trebuie să aibă CTA clar spre programare.",
    christmas_promo:
      "Scrie o promoție de Crăciun/sărbători pentru salon: ofertă specială plauzibilă, urgență blândă, ton festiv dar profesionist.",
    service_promo: selectedService
      ? `Promovează serviciul „${selectedService.name}” (${selectedService.duration} min). Evidențiază pentru cine e potrivit și de ce merită rezervat acum.`
      : "Promovează un serviciu principal din listă.",
    birthday_offer:
      "Scrie o ofertă de aniversare a salonului (ex. reducere sau beneficiu extra la programare). Ton celebrativ, exclusivitate, limitare în timp.",
  };

  const extra = input.extraNotes?.trim()
    ? `\nNote suplimentare de la frizer: ${input.extraNotes.trim()}`
    : "";

  return `Ești copywriter pentru frizerii din România. Generează conținut de marketing în limba română pentru: ${label}.

DATE SALON:
${formatSalonBlock(context)}

INSTRUCȚIUNI TIP CONȚINUT:
${typeInstructions[input.contentType]}

REGULI:
- Scrie natural, fără clișee exagerate
- Folosește diacritice românești
- Nu inventa prețuri sau reduceri concrete dacă nu sunt în date; poți folosi formulări gen „ofertă specială” sau „surpriză la programare”
- Include mereu un call-to-action spre linkul de programare
- Hashtag-urile trebuie relevante pentru România (frizerie, barbershop, oraș dacă e în adresă)
- Răspunde DOAR cu JSON valid, fără markdown, în formatul:
{"title":"titlu scurt","content":"textul principal","hashtags":["tag1","tag2"],"callToAction":"propoziție CTA"}${extra}`;
}

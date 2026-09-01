import type {
  MarketingTestimonialUserType,
} from "./types";

const USER_TYPES = new Set<MarketingTestimonialUserType>([
  "independent",
  "barbershop",
]);

export type ParsedMarketingTestimonialInput = {
  rating: number;
  authorName: string;
  salonName: string | null;
  city: string | null;
  userType: MarketingTestimonialUserType;
  body: string;
  displayConsent: boolean;
};

export function parseMarketingTestimonialFields(
  formData: FormData,
): { ok: true; value: ParsedMarketingTestimonialInput } | { ok: false; error: string } {
  const ratingRaw = Number(formData.get("rating"));
  const authorName = String(formData.get("authorName") ?? "").trim();
  const salonName = String(formData.get("salonName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const userType = String(formData.get("userType") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const displayConsent = formData.get("displayConsent") === "true";

  if (!Number.isInteger(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
    return { ok: false, error: "Alege un rating între 1 și 5 stele." };
  }

  if (authorName.length < 2) {
    return { ok: false, error: "Introdu numele tău." };
  }

  if (!USER_TYPES.has(userType as MarketingTestimonialUserType)) {
    return { ok: false, error: "Alege tipul de utilizator." };
  }

  if (body.length < 10) {
    return { ok: false, error: "Recenzia trebuie să aibă cel puțin 10 caractere." };
  }

  if (body.length > 2000) {
    return { ok: false, error: "Recenzia poate avea maximum 2000 de caractere." };
  }

  if (!displayConsent) {
    return {
      ok: false,
      error:
        "Trebuie să fii de acord ca recenzia ta să fie afișată pe site-ul Frizeo.",
    };
  }

  return {
    ok: true,
    value: {
      rating: ratingRaw,
      authorName,
      salonName: salonName || null,
      city: city || null,
      userType: userType as MarketingTestimonialUserType,
      body,
      displayConsent,
    },
  };
}

export const LEGAL_COMPANY = {
  name: "Electricsmart.Co SRL",
  cui: "47684690",
  regCom: "J02/287/2023",
  address: "România, Arad, Socodor, nr. 77",
  representative: "Maris Toader",
  email: "info@frizeo.ro",
  privacyEmail: "info@frizeo.ro",
  billingEmail: "office@frizeo.ro",
  /** Display format used on the site (Romanian mobile). */
  phone: "0753 332 181",
  /** E.164 for `tel:` links, schema.org and WhatsApp. */
  phoneE164: "+40753332181",
  website: "https://www.frizeo.ro",
  lastUpdated: "15 septembrie 2026",
};

export function companyTelHref(): string {
  return `tel:${LEGAL_COMPANY.phoneE164}`;
}

/** WhatsApp Business for Frizeo on the company phone. */
export function companyWhatsAppUrl(): string {
  return `https://wa.me/${LEGAL_COMPANY.phoneE164.replace(/^\+/, "")}`;
}

export const LEGAL_LINKS = {
  anpc: "https://anpc.ro",
  sol: "https://ec.europa.eu/consumers/odr",
};

export function hasCompanyDetails(): boolean {
  return !LEGAL_COMPANY.name.startsWith("[");
}

export function companyFooterLine(): string | null {
  if (!hasCompanyDetails()) return null;

  return `${LEGAL_COMPANY.name} · CUI ${LEGAL_COMPANY.cui} · ${LEGAL_COMPANY.regCom} · ${LEGAL_COMPANY.address}`;
}

export type PricingPlan = {
  slug: string;
  name: string;
  price: string;
  priceNote?: string;
  barbers: string;
  bookings: string;
  sms: boolean;
  highlighted?: boolean;
  cta: { label: string; href: string };
  features: string[];
};

export const LEGAL_PRICING = {
  trialDays: 30,
  includedNote:
    "Email inclus pe toate planurile. SMS reminder pe Pro / Pro+ / trial. Fără credite și fără reîncărcări.",
  trialNote:
    "Trial 30 zile: frizer independent → Pro (1 loc, fără invitații); salon → Pro+ (până la 3 frizeri, cu invitații).",
  plans: [
    {
      slug: "free",
      name: "Free",
      price: "0 lei",
      priceNote: "/ lună",
      barbers: "1 frizer activ",
      bookings: "80 programări / lună",
      sms: false,
      cta: { label: "Creează cont", href: "/signup" },
      features: [
        "Link programări online",
        "Pagină publică a salonului (pregătită pentru Google)",
        "Calendar și servicii",
        "Notificări email",
        "Marketing AI (3 generări / zi)",
        "Program săptămânal",
      ],
    },
    {
      slug: "pro",
      name: "Pro",
      price: "79 lei",
      priceNote: "/ lună",
      barbers: "1 frizer (fără invitații)",
      bookings: "Programări nelimitate",
      sms: true,
      highlighted: true,
      cta: { label: "Începe trial 30 zile", href: "/signup" },
      features: [
        "Tot din Free",
        "1 frizer — fără invitații echipă",
        "SMS reminder inclus",
        "Marketing AI (20 generări / zi)",
        "Confirmare / anulare / reprogramare pe email",
        "Google Calendar",
        "Zile speciale / override",
      ],
    },
    {
      slug: "pro-plus",
      name: "Pro+",
      price: "199 lei",
      priceNote: "/ lună",
      barbers: "Până la 3 frizeri + invitații",
      bookings: "Programări nelimitate",
      sms: true,
      cta: { label: "Începe trial 30 zile", href: "/signup" },
      features: [
        "Tot din Pro",
        "Echipă până la 3 frizeri",
        "Invitații în limita locurilor (admin 3 / admin+frizer 2)",
        "Marketing AI (50 generări / zi)",
        "Vizibilitate programări pe toată echipa",
      ],
    },
    {
      slug: "custom",
      name: "Custom",
      price: "La cerere",
      barbers: "Personalizat",
      bookings: "Programări nelimitate",
      sms: true,
      cta: { label: "Contactează-ne", href: "/contact" },
      features: [
        "Mai mulți frizeri / locații",
        "SMS extins (confirmare / anulare / reprogramare) la cerere",
        "Marketing AI cu limite personalizate",
        "Preț negociat",
        "Suport dedicat",
        "Activare manuală",
      ],
    },
  ] satisfies PricingPlan[],
};

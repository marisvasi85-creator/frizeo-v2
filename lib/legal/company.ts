export const LEGAL_COMPANY = {
  name: "Electricsmart.Co SRL",
  cui: "47684690",
  regCom: "J02/287/2023",
  address: "România, Arad, Socodor, nr. 77",
  representative: "Maris Toader",
  email: "info@frizeo.ro",
  privacyEmail: "info@frizeo.ro",
  billingEmail: "office@frizeo.ro",
  website: "https://www.frizeo.ro",
  lastUpdated: "20 iunie 2026",
};

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
  trialDays: 15,
  plans: [
    {
      slug: "free",
      name: "Free",
      price: "0 lei",
      priceNote: "/ lună",
      barbers: "1 frizer",
      bookings: "80 programări / lună",
      sms: false,
      cta: { label: "Creează cont", href: "/signup" },
      features: [
        "Link programări online",
        "Calendar și servicii",
        "Notificări email",
        "Program săptămânal",
      ],
    },
    {
      slug: "pro",
      name: "Pro",
      price: "59 lei",
      priceNote: "/ lună",
      barbers: "1 frizer",
      bookings: "Programări nelimitate",
      sms: true,
      highlighted: true,
      cta: { label: "Începe trial 15 zile", href: "/signup" },
      features: [
        "Tot din Free",
        "SMS confirmare și reminder",
        "Google Calendar",
        "Zile speciale / override",
      ],
    },
    {
      slug: "pro-plus",
      name: "Pro+",
      price: "129 lei",
      priceNote: "/ lună",
      barbers: "Până la 3 frizeri",
      bookings: "Programări nelimitate",
      sms: true,
      cta: { label: "Începe trial 15 zile", href: "/signup" },
      features: [
        "Tot din Pro",
        "Echipă până la 3 frizeri",
        "Invitații frizeri",
        "Vizibilitate programări salon",
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
        "Preț negociat",
        "Suport dedicat",
        "Activare manuală",
      ],
    },
  ] satisfies PricingPlan[],
};

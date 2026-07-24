import { LEGAL_COMPANY, LEGAL_PRICING } from "@/lib/legal/company";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site/metadata";
import { pageUrl } from "@/lib/site/pageMetadata";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: LEGAL_COMPANY.name,
    legalName: LEGAL_COMPANY.name,
    url: LEGAL_COMPANY.website,
    logo: pageUrl("/icon"),
    email: LEGAL_COMPANY.email,
    address: {
      "@type": "PostalAddress",
      addressCountry: "RO",
      addressLocality: "Arad",
      streetAddress: LEGAL_COMPANY.address,
    },
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: LEGAL_COMPANY.website,
    description: SITE_DESCRIPTION,
    inLanguage: "ro-RO",
    publisher: {
      "@type": "Organization",
      name: LEGAL_COMPANY.name,
      url: LEGAL_COMPANY.website,
    },
  };
}

export function softwareApplicationJsonLd() {
  const paidPlans = LEGAL_PRICING.plans.filter(
    (plan) => plan.slug === "pro" || plan.slug === "pro-plus"
  );

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: LEGAL_COMPANY.website,
    description: SITE_DESCRIPTION,
    offers: paidPlans.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: plan.price.replace(/[^\d]/g, "") || "0",
      priceCurrency: "RON",
      url: pageUrl("/pricing"),
    })),
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: pageUrl(item.path),
    })),
  };
}

export function contactPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact ${SITE_NAME}`,
    url: pageUrl("/contact"),
    mainEntity: {
      "@type": "Organization",
      name: LEGAL_COMPANY.name,
      email: LEGAL_COMPANY.email,
      url: LEGAL_COMPANY.website,
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: LEGAL_COMPANY.email,
          availableLanguage: ["Romanian"],
        },
        {
          "@type": "ContactPoint",
          contactType: "billing support",
          email: LEGAL_COMPANY.billingEmail,
          availableLanguage: ["Romanian"],
        },
      ],
    },
  };
}

type SalonJsonLdInput = {
  name: string;
  slug: string;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  imageUrls?: string[] | null;
  streetAddress?: string | null;
  city?: string | null;
  county?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: string[] | null;
  openingHoursSpecification?: Array<Record<string, unknown>> | null;
  priceRange?: string | null;
  mapsUrl?: string | null;
};

export function salonJsonLd(salon: SalonJsonLdInput) {
  const images = [
    ...(salon.logoUrl ? [salon.logoUrl] : []),
    ...(salon.imageUrls || []),
  ].filter(Boolean);

  const hasStructuredAddress =
    Boolean(salon.streetAddress) ||
    Boolean(salon.city) ||
    Boolean(salon.address);

  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: salon.name,
    url: pageUrl(`/booking/salon/${salon.slug}`),
    ...(salon.phone ? { telephone: salon.phone } : {}),
    ...(salon.description ? { description: salon.description } : {}),
    ...(images.length === 1
      ? { image: images[0] }
      : images.length > 1
        ? { image: images }
        : {}),
    ...(salon.priceRange ? { priceRange: salon.priceRange } : {}),
    ...(salon.mapsUrl ? { hasMap: salon.mapsUrl } : {}),
    ...(salon.openingHours && salon.openingHours.length > 0
      ? { openingHours: salon.openingHours }
      : {}),
    ...(salon.openingHoursSpecification &&
    salon.openingHoursSpecification.length > 0
      ? { openingHoursSpecification: salon.openingHoursSpecification }
      : {}),
    ...(hasStructuredAddress
      ? {
          address: {
            "@type": "PostalAddress",
            ...(salon.streetAddress
              ? { streetAddress: salon.streetAddress }
              : salon.address
                ? { streetAddress: salon.address }
                : {}),
            ...(salon.city ? { addressLocality: salon.city } : {}),
            ...(salon.county ? { addressRegion: salon.county } : {}),
            ...(salon.postalCode ? { postalCode: salon.postalCode } : {}),
            addressCountry: "RO",
          },
        }
      : {}),
    ...(typeof salon.latitude === "number" &&
    typeof salon.longitude === "number"
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: salon.latitude,
            longitude: salon.longitude,
          },
        }
      : {}),
  };
}

type BarberBookingJsonLdInput = {
  salon: SalonJsonLdInput;
  barberName: string;
  barberSlug: string;
};

export function barberBookingJsonLd({
  salon,
  barberName,
  barberSlug,
}: BarberBookingJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Programare online — ${barberName}`,
    url: pageUrl(`/booking/salon/${salon.slug}/${barberSlug}`),
    description: `Programează-te online la ${barberName}, ${salon.name}.`,
    isPartOf: salonJsonLd(salon),
    about: {
      "@type": "Person",
      name: barberName,
    },
  };
}

export function jsonLdGraph(
  ...items: Record<string, unknown>[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": items.map(({ "@context": _context, ...rest }) => rest),
  };
}

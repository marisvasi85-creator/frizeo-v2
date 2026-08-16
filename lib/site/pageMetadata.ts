import type { Metadata } from "next";
import {
  pwaIconHref,
  pwaManifestHref,
  type PwaManifestVariant,
} from "@/lib/pwa/manifestContent";
import { SITE_NAME, SITE_URL } from "@/lib/site/metadata";

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
  image?: string | null;
  /** Server-side PWA manifest so Add to Home Screen opens this path, not admin login. */
  pwa?: {
    startUrl: string;
    variant: PwaManifestVariant;
    label?: string | null;
    logo?: string | null;
  };
};

export function pageUrl(path: string): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, SITE_URL).toString();
}

export function createPageMetadata({
  title,
  description,
  path,
  keywords,
  noIndex = false,
  image,
  pwa,
}: PageMetadataOptions): Metadata {
  const url = pageUrl(path);
  const ogImage = image?.trim() || pageUrl("/opengraph-image");
  const twitterImage = image?.trim() || pageUrl("/twitter-image");
  const bookingBrand =
    pwa?.variant === "booking" &&
    Boolean(pwa.label?.trim() || pwa.logo?.trim());

  return {
    title,
    description,
    keywords,
    ...(pwa
      ? {
          manifest: pwaManifestHref(pwa),
          appleWebApp: {
            capable: true,
            title:
              pwa.variant === "booking" && pwa.label?.trim()
                ? pwa.label.trim().slice(0, 12)
                : SITE_NAME,
            statusBarStyle:
              pwa.variant === "admin" ? "black-translucent" : "default",
          },
          ...(bookingBrand
            ? {
                icons: {
                  apple: pwaIconHref({
                    size: 180,
                    label: pwa.label,
                    logo: pwa.logo,
                  }),
                  icon: [
                    {
                      url: pwaIconHref({
                        size: 192,
                        label: pwa.label,
                        logo: pwa.logo,
                      }),
                      sizes: "192x192",
                      type: "image/png",
                    },
                  ],
                },
              }
            : {}),
        }
      : {}),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      type: "website",
      locale: "ro_RO",
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [twitterImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false },
};

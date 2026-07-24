import type { Metadata } from "next";
import {
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
  const ogImage = image?.trim() || undefined;

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
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: `${title} | ${SITE_NAME}`,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false },
};

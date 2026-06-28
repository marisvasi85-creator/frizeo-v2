import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site/metadata";

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
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
}: PageMetadataOptions): Metadata {
  const url = pageUrl(path);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
    },
    twitter: {
      title: `${title} | ${SITE_NAME}`,
      description,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false },
};

import type { Metadata } from "next";
import { LEGAL_COMPANY } from "@/lib/legal/company";

export const SITE_NAME = "Frizeo";

export const SITE_URL = new URL(LEGAL_COMPANY.website);

export const SITE_DESCRIPTION =
  "Programări online pentru frizerii, barbershop-uri și saloane din România. Aplicație pentru programări cu link personal, notificări, Marketing AI, director local și sync Google Calendar.";

export const SITE_TAGLINE =
  "Programări online pentru frizerii, barbershop-uri și saloane";

export const siteMetadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // No global installable manifest: marketing/login pages must not claim scope `/`.
  // Admin PWA is set in `app/admin/layout.tsx`; client PWAs on booking pages.
  keywords: [
    "programări online frizerie",
    "programări online barbershop",
    "software pentru frizerii",
    "software pentru saloane",
    "aplicație pentru programări",
    "Frizeo",
  ],
  authors: [{ name: SITE_NAME, url: LEGAL_COMPANY.website }],
  creator: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "ro_RO",
    url: LEGAL_COMPANY.website,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

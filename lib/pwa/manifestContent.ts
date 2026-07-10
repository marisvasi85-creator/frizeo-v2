import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site/metadata";

const ICONS = [
  {
    src: "/pwa-icon-192",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/brand/frizeo-logo-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/brand/frizeo-logo-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
] as const;

export type PwaManifestVariant = "admin" | "booking";

export function isAllowedPwaStartPath(path: string): boolean {
  return (
    path === "/admin/dashboard" ||
    path.startsWith("/booking/salon/") ||
    path.startsWith("/booking/confirmed/")
  );
}

export function buildWebManifest(options: {
  startUrl: string;
  variant: PwaManifestVariant;
  label?: string | null;
}) {
  const bookingLabel = options.label?.trim();

  const name =
    options.variant === "admin"
      ? `${SITE_NAME} — Panou frizer`
      : bookingLabel
        ? `Programări — ${bookingLabel}`
        : `${SITE_NAME} — Programări`;

  const shortName =
    options.variant === "admin"
      ? SITE_NAME
      : bookingLabel
        ? bookingLabel.slice(0, 12)
        : "Programări";

  const description =
    options.variant === "admin"
      ? SITE_DESCRIPTION
      : "Programează-te rapid la frizer, direct de pe ecranul Acasă.";

  return {
    name,
    short_name: shortName,
    description,
    start_url: options.startUrl,
    scope: "/",
    display: "standalone" as const,
    orientation: "portrait" as const,
    background_color: options.variant === "admin" ? "#0B0B0C" : "#FFFFFF",
    theme_color: options.variant === "admin" ? "#0B0B0C" : "#FFFFFF",
    lang: "ro",
    icons: [...ICONS],
  };
}

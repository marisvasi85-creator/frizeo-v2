import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site/metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Panou frizer`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/admin/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0B0C",
    theme_color: "#0B0B0C",
    lang: "ro",
    icons: [
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
    ],
  };
}

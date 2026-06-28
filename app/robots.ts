import type { MetadataRoute } from "next";
import { LEGAL_COMPANY } from "@/lib/legal/company";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/login",
        "/reset-password",
        "/cancel/",
        "/reschedule/",
        "/accept-invite/",
        "/booking/confirmed/",
      ],
    },
    sitemap: `${LEGAL_COMPANY.website}/sitemap.xml`,
  };
}

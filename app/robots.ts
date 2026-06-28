import type { MetadataRoute } from "next";
import { LEGAL_COMPANY } from "@/lib/legal/company";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${LEGAL_COMPANY.website}/sitemap.xml`,
  };
}

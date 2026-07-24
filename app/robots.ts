import type { MetadataRoute } from "next";
import { getPublicBaseUrl } from "@/lib/seo/getPublicBaseUrl";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getPublicBaseUrl();

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
    sitemap: `${base}/sitemap.xml`,
  };
}

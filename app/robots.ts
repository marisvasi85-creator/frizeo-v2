import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import {
  hostnameFromHeaderStore,
  shouldIndexForSearchEngines,
} from "@/lib/app/environment";
import { getPublicBaseUrl } from "@/lib/seo/getPublicBaseUrl";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerStore = await headers();
  const host = hostnameFromHeaderStore(headerStore);
  const base = await getPublicBaseUrl();

  if (!shouldIndexForSearchEngines(host)) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

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
        "/review/",
        "/barbers",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

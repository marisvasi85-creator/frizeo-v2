import { headers } from "next/headers";
import { getAppUrl } from "@/lib/app/getAppUrl";

/**
 * Base URL for sitemap/robots — prefers the request host so staging.frizeo.ro
 * does not emit www.frizeo.ro links.
 */
export async function getPublicBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") || h.get("host") || "")
      .split(",")[0]
      .trim();

    if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
      const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim();
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // headers() unavailable outside request context
  }

  return getAppUrl().replace(/\/$/, "");
}

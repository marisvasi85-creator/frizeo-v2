import { NextRequest, NextResponse } from "next/server";
import {
  ATTRIBUTION_COOKIE,
  appendMarketingUtmParams,
  attributionCookieOptions,
  getAttributionLink,
  isAttributionFresh,
  markAttributionLinkClicked,
} from "@/lib/frizeo-email/attribution";
import { getFrizeoAppUrl } from "@/lib/frizeo-email/config";

export const runtime = "nodejs";

/**
 * Opaque marketing attribution redirect.
 * Invalid/expired tokens never error for the user — soft-fallback to app home.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const fallback = getFrizeoAppUrl().replace(/\/$/, "") || "https://www.frizeo.ro";

  try {
    const link = await getAttributionLink(token);
    if (!link || link.is_test || !isAttributionFresh(link.created_at)) {
      return NextResponse.redirect(fallback, 302);
    }

    await markAttributionLinkClicked(link.id);

    const destination = appendMarketingUtmParams(
      link.destination_url,
      link.utm_campaign,
    );

    const response = NextResponse.redirect(destination, 302);
    response.cookies.set(
      ATTRIBUTION_COOKIE,
      link.id,
      attributionCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("[marketing-attribution] redirect failed", error);
    return NextResponse.redirect(fallback, 302);
  }
}

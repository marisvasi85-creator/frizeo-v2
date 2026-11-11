import {
  GOOGLE_BUSINESS_SUMMARY_MAX,
  googleBookAction,
} from "@/lib/integrations/google-business/flow";
import { isGoogleLocationId, isGooglePostId } from "@/lib/integrations/google-business/config";

export type GoogleHttp = (input: {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ status: number; body: unknown }>;

export type GoogleLocalPost = {
  languageCode: "ro";
  summary: string;
  topicType: "STANDARD";
  callToAction: { actionType: "BOOK"; url: string };
  media?: Array<{ mediaFormat: "PHOTO"; sourceUrl: string }>;
};

export function buildGoogleLocalPost(input: {
  summary: string;
  bookingUrl: string | null | undefined;
  imageUrl?: string | null;
}): { ok: true; body: GoogleLocalPost } | { ok: false; reason: "summary" | "booking_link" | "image" } {
  const summary = input.summary.replace(/\*\*/g, "").trim();
  if (!summary || summary.length > GOOGLE_BUSINESS_SUMMARY_MAX || summary.includes("\u0000")) {
    return { ok: false, reason: "summary" };
  }
  const callToAction = googleBookAction(input.bookingUrl);
  if (!callToAction) return { ok: false, reason: "booking_link" };
  const body: GoogleLocalPost = {
    languageCode: "ro",
    summary,
    topicType: "STANDARD",
    callToAction,
  };
  if (input.imageUrl) {
    let image: URL;
    try {
      image = new URL(input.imageUrl);
    } catch {
      return { ok: false, reason: "image" };
    }
    if (image.protocol !== "https:") return { ok: false, reason: "image" };
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: image.toString() }];
  }
  return { ok: true, body };
}

/**
 * Prepared for a later live route. The staging live route does not call this.
 * Tests pass an injected HTTP client; there is no default network call.
 */
export async function publishLocalPost(input: {
  http: GoogleHttp;
  accessToken: string;
  locationId: string;
  post: GoogleLocalPost;
}): Promise<
  | { ok: true; providerPostId: string; externalCall: true }
  | { ok: false; reason: "invalid_location" | "request_failed" | "unconfirmed"; externalCall: boolean }
> {
  if (!isGoogleLocationId(input.locationId) || !input.accessToken) {
    return { ok: false, reason: "invalid_location", externalCall: false };
  }
  let response: { status: number; body: unknown };
  try {
    response = await input.http({
      url: `https://mybusiness.googleapis.com/v4/${input.locationId}/localPosts`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.post),
    });
  } catch {
    return { ok: false, reason: "request_failed", externalCall: true };
  }
  const name = response.body && typeof response.body === "object"
    ? (response.body as { name?: unknown }).name
    : null;
  if (response.status < 200 || response.status >= 300 || typeof name !== "string" || !isGooglePostId(name)) {
    return { ok: false, reason: "unconfirmed", externalCall: true };
  }
  return { ok: true, providerPostId: name, externalCall: true };
}

import {
  GOOGLE_BUSINESS_SUMMARY_MAX,
  googleBookAction,
} from "@/lib/integrations/google-business/flow";
import { googleSignedImageUrl } from "@/lib/integrations/google-business/image";
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
  callToAction?: { actionType: "BOOK"; url: string };
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
  const requestedBooking = input.bookingUrl?.trim() ?? "";
  const callToAction = requestedBooking ? googleBookAction(requestedBooking) : null;
  if (requestedBooking && !callToAction) return { ok: false, reason: "booking_link" };
  const body: GoogleLocalPost = {
    languageCode: "ro",
    summary,
    topicType: "STANDARD",
    ...(callToAction ? { callToAction } : {}),
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

export function buildGoogleTextPost(summary: string):
  | { ok: true; body: GoogleLocalPost }
  | { ok: false; reason: "summary" } {
  const text = summary.replace(/\*\*/g, "").trim();
  if (!text || text.length > GOOGLE_BUSINESS_SUMMARY_MAX || text.includes("\u0000")) {
    return { ok: false, reason: "summary" };
  }
  return {
    ok: true,
    body: {
      languageCode: "ro",
      summary: text,
      topicType: "STANDARD",
    },
  };
}

export function buildGoogleImagePost(input: {
  summary: string;
  imageUrl: string;
  tenantId: string;
}): { ok: true; body: GoogleLocalPost } | { ok: false; reason: "summary" | "image" } {
  const summary = input.summary.replace(/\*\*/g, "").trim();
  if (!summary || summary.length > GOOGLE_BUSINESS_SUMMARY_MAX || summary.includes("\u0000")) {
    return { ok: false, reason: "summary" };
  }
  const image = googleSignedImageUrl(input.imageUrl, input.tenantId);
  if (!image) return { ok: false, reason: "image" };
  return {
    ok: true,
    body: {
      languageCode: "ro",
      summary,
      topicType: "STANDARD",
      media: [{ mediaFormat: "PHOTO", sourceUrl: image.toString() }],
    },
  };
}

export function classifyGoogleLocalPostResponse(status: number, body: unknown):
  | { ok: true; providerPostId: string }
  | { ok: false; outcome: "failed"; safeError: "invalid_parameter" | "unauthorized" | "forbidden" | "not_found" | "rate_limited" | "rejected" }
  | { ok: false; outcome: "unknown"; safeError: "ambiguous" } {
  if (status >= 200 && status < 300) {
    const name = body && typeof body === "object" ? (body as { name?: unknown }).name : null;
    if (typeof name === "string" && isGooglePostId(name)) return { ok: true, providerPostId: name };
    return { ok: false, outcome: "unknown", safeError: "ambiguous" };
  }
  if (status === 400) return { ok: false, outcome: "failed", safeError: "invalid_parameter" };
  if (status === 401) return { ok: false, outcome: "failed", safeError: "unauthorized" };
  if (status === 403) return { ok: false, outcome: "failed", safeError: "forbidden" };
  if (status === 404) return { ok: false, outcome: "failed", safeError: "not_found" };
  if (status === 429) return { ok: false, outcome: "failed", safeError: "rate_limited" };
  if (status >= 400 && status < 500) return { ok: false, outcome: "failed", safeError: "rejected" };
  return { ok: false, outcome: "unknown", safeError: "ambiguous" };
}

/**
 * Posts one text local post. Callers inject HTTP in tests.
 * A 4xx response is a definite failure. A missing post id, a 5xx response,
 * or a network error stays unconfirmed.
 */
export async function publishLocalPost(input: {
  http: GoogleHttp;
  accessToken: string;
  locationId: string;
  post: GoogleLocalPost;
}): Promise<
  | { ok: true; providerPostId: string; externalCall: true }
  | { ok: false; reason: "invalid_location"; externalCall: false }
  | { ok: false; reason: "rejected"; safeError: string; httpStatus: number; externalCall: true }
  | { ok: false; reason: "unconfirmed"; safeError: "ambiguous"; httpStatus: number | null; externalCall: true }
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
    return { ok: false, reason: "unconfirmed", safeError: "ambiguous", httpStatus: null, externalCall: true };
  }
  const classified = classifyGoogleLocalPostResponse(response.status, response.body);
  if (classified.ok) return { ok: true, providerPostId: classified.providerPostId, externalCall: true };
  if (classified.outcome === "failed") {
    return { ok: false, reason: "rejected", safeError: classified.safeError, httpStatus: response.status, externalCall: true };
  }
  return { ok: false, reason: "unconfirmed", safeError: "ambiguous", httpStatus: response.status, externalCall: true };
}

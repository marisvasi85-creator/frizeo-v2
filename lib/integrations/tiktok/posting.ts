import {
  TIKTOK_CONTENT_POSTING_LIVE,
  TIKTOK_PUBLISH_SCOPE,
  TIKTOK_SCOPE,
  TIKTOK_UPLOAD_SCOPE,
} from "@/lib/integrations/tiktok/config";
import type { TikTokHttp } from "@/lib/integrations/tiktok/api";

export const TIKTOK_PHOTO_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/content/init/";
export const TIKTOK_VIDEO_INBOX_URL = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
export const TIKTOK_VIDEO_DIRECT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
export const TIKTOK_STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
export const TIKTOK_CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";

const PUBLISH_ID = /^v_[A-Za-z0-9][A-Za-z0-9._~-]{7,160}$/;
const ALLOWED_HOSTS = new Set([
  "staging.frizeo.ro",
  "www.frizeo.ro",
  "frizeo.ro",
  "fanxxytfuhnakfdzwssd.supabase.co",
]);
const SAFE_ERRORS = new Set([
  "spam_risk_too_many_posts",
  "spam_risk_user_banned_from_posting",
  "reached_active_user_cap",
  "unaudited_client_can_only_post_to_private_accounts",
  "url_ownership_unverified",
  "privacy_level_option_mismatch",
  "scope_not_authorized",
  "access_token_invalid",
  "rate_limit_exceeded",
  "file_format_check_failed",
  "picture_size_check_failed",
  "duration_check_failed",
  "frame_rate_check_failed",
  "internal_error",
]);

export type TikTokPostError =
  | "capability_off"
  | "live_off"
  | "upload_scope_required"
  | "publish_scope_required"
  | "direct_post_inactive"
  | "video_not_enabled"
  | "already_started"
  | "invalid_media"
  | "invalid_caption"
  | "rate_limited"
  | "network"
  | "unconfirmed"
  | "provider_error"
  | "unaudited_private_only";

export function isTikTokPublishId(value: string): boolean {
  return PUBLISH_ID.test(value);
}

export function safeTikTokPostError(code: string | null): string {
  if (code === "rate_limit_exceeded") return "rate_limited";
  if (code && SAFE_ERRORS.has(code)) return code;
  return "provider_error";
}

export function tikTokIdempotencyDecision(input: {
  existing: { caption: string; mediaPath: string; executionMode: string } | null;
  caption: string;
  mediaPath: string;
}): "create" | "replay" | "conflict" {
  if (!input.existing) return "create";
  if (
    input.existing.executionMode === "mock"
    && input.existing.caption === input.caption
    && input.existing.mediaPath === input.mediaPath
  ) {
    return "replay";
  }
  return "conflict";
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function tikTokPhotoCaption(caption: string): { ok: true; title: string; description: string } | { ok: false; reason: "invalid_caption" } {
  const description = caption.replace(/\u0000/g, "").trim();
  if (!description || description.length > 4000) return { ok: false, reason: "invalid_caption" };
  const title = description.replace(/\s+/g, " ").slice(0, 90).trim();
  if (!title) return { ok: false, reason: "invalid_caption" };
  return { ok: true, title, description };
}

export function tikTokMediaUrl(value: string, kind: "photo" | "video"): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) return null;
  if (url.username || url.password || url.hash) return null;
  if ([...url.searchParams.keys()].some((key) => key.toLowerCase() === "access_token")) return null;
  const path = url.pathname.toLowerCase();
  if (kind === "photo" && !/[.](jpg|jpeg|webp)$/.test(path)) return null;
  if (kind === "video" && !/[.](mp4|mov)$/.test(path)) return null;
  if (url.hostname === "fanxxytfuhnakfdzwssd.supabase.co"
    && !url.pathname.startsWith("/storage/v1/object/sign/marketing-publish/")) {
    return null;
  }
  return url;
}

export function buildPhotoInboxRequest(input: { title: string; description: string; imageUrl: string }) {
  return {
    post_info: { title: input.title, description: input.description },
    source_info: {
      source: "PULL_FROM_URL",
      photo_cover_index: 0,
      photo_images: [input.imageUrl],
    },
    post_mode: "MEDIA_UPLOAD",
    media_type: "PHOTO",
  };
}

export function buildPhotoDirectRequest(input: { title: string; description: string; imageUrl: string }) {
  return {
    post_info: {
      title: input.title,
      description: input.description,
      privacy_level: "SELF_ONLY",
      disable_comment: true,
      auto_add_music: false,
      brand_content_toggle: false,
      brand_organic_toggle: false,
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_cover_index: 0,
      photo_images: [input.imageUrl],
    },
    post_mode: "DIRECT_POST",
    media_type: "PHOTO",
  };
}

export function buildVideoInboxRequest(videoUrl: string) {
  return { source_info: { source: "PULL_FROM_URL", video_url: videoUrl } };
}

export function directPostPrivacy(options: readonly string[]): { ok: true; privacy: "SELF_ONLY" } | { ok: false; reason: "unaudited_private_only" } {
  if (!options.includes("SELF_ONLY")) return { ok: false, reason: "unaudited_private_only" };
  return { ok: true, privacy: "SELF_ONLY" };
}

export function interpretTikTokStatus(status: string): {
  outcome: "inbox_ready" | "pending" | "failed" | "direct_complete" | "unknown";
  published: false;
} {
  if (status === "SEND_TO_USER_INBOX") return { outcome: "inbox_ready", published: false };
  if (status === "PROCESSING_UPLOAD" || status === "PROCESSING_DOWNLOAD") {
    return { outcome: "pending", published: false };
  }
  if (status === "FAILED") return { outcome: "failed", published: false };
  if (status === "PUBLISH_COMPLETE") return { outcome: "direct_complete", published: false };
  return { outcome: "unknown", published: false };
}

type CallResult = { status: number; body: unknown } | { thrown: true };

async function callWithRetry(input: {
  http: TikTokHttp;
  request: Parameters<TikTokHttp>[0];
  kind: "init" | "status";
}): Promise<{ calls: number; result: CallResult }> {
  let calls = 0;
  const once = async (): Promise<CallResult> => {
    calls += 1;
    try {
      return await input.http(input.request);
    } catch {
      return { thrown: true };
    }
  };
  const first = await once();
  const retryNetwork = "thrown" in first;
  const retryStatus = input.kind === "status" && !("thrown" in first) && first.status === 429;
  if (retryNetwork || retryStatus) {
    const second = await once();
    return { calls, result: second };
  }
  return { calls, result: first };
}

function errorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  return text((error as { code?: unknown }).code);
}

export async function initTikTokPhotoInbox(input: {
  http: TikTokHttp;
  accessToken: string;
  scopes: readonly string[];
  capabilityEnabled: boolean;
  liveEnabled?: boolean;
  existingPublishId?: string | null;
  caption: string;
  imageUrl: string;
}): Promise<
  | { ok: true; publishId: string; externalCall: true; attempts: number }
  | { ok: false; reason: TikTokPostError; externalCall: boolean; attempts: number }
> {
  const liveEnabled = input.liveEnabled ?? TIKTOK_CONTENT_POSTING_LIVE;
  if (!input.capabilityEnabled) return { ok: false, reason: "capability_off", externalCall: false, attempts: 0 };
  if (!liveEnabled) return { ok: false, reason: "live_off", externalCall: false, attempts: 0 };
  if (!input.scopes.includes(TIKTOK_SCOPE) || !input.scopes.includes(TIKTOK_UPLOAD_SCOPE)) {
    return { ok: false, reason: "upload_scope_required", externalCall: false, attempts: 0 };
  }
  if (input.scopes.includes(TIKTOK_PUBLISH_SCOPE)) {
    return { ok: false, reason: "provider_error", externalCall: false, attempts: 0 };
  }
  if (input.existingPublishId) {
    return { ok: false, reason: "already_started", externalCall: false, attempts: 0 };
  }
  const caption = tikTokPhotoCaption(input.caption);
  const image = tikTokMediaUrl(input.imageUrl, "photo");
  if (!caption.ok) return { ok: false, reason: "invalid_caption", externalCall: false, attempts: 0 };
  if (!image || !input.accessToken) return { ok: false, reason: "invalid_media", externalCall: false, attempts: 0 };

  const called = await callWithRetry({
    kind: "init",
    http: input.http,
    request: {
      url: TIKTOK_PHOTO_INIT_URL,
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPhotoInboxRequest({
        title: caption.title,
        description: caption.description,
        imageUrl: image.toString(),
      })),
    },
  });
  if ("thrown" in called.result) {
    return { ok: false, reason: "network", externalCall: true, attempts: called.calls };
  }
  if (called.result.status === 429) {
    return { ok: false, reason: "rate_limited", externalCall: true, attempts: called.calls };
  }
  const data = called.result.body && typeof called.result.body === "object"
    ? (called.result.body as { data?: { publish_id?: unknown } }).data
    : null;
  const publishId = text(data?.publish_id);
  const code = errorCode(called.result.body);
  if (
    called.result.status < 200
    || called.result.status >= 300
    || (code && code !== "ok")
    || !publishId
    || !isTikTokPublishId(publishId)
  ) {
    const reason = called.result.status === 429
      ? "rate_limited"
      : safeTikTokPostError(code) === "rate_limited"
        ? "rate_limited"
        : "unconfirmed";
    return { ok: false, reason, externalCall: true, attempts: called.calls };
  }
  return { ok: true, publishId, externalCall: true, attempts: called.calls };
}

export async function initTikTokDirectPost(input: {
  http: TikTokHttp;
}): Promise<{ ok: false; reason: "direct_post_inactive"; externalCall: false; attempts: 0 }> {
  void input.http;
  return { ok: false, reason: "direct_post_inactive", externalCall: false, attempts: 0 };
}

export async function initTikTokVideoInbox(): Promise<{ ok: false; reason: "video_not_enabled"; externalCall: false; attempts: 0 }> {
  return { ok: false, reason: "video_not_enabled", externalCall: false, attempts: 0 };
}

export async function fetchTikTokPublishStatus(input: {
  http: TikTokHttp;
  accessToken: string;
  publishId: string;
  capabilityEnabled: boolean;
  liveEnabled?: boolean;
}): Promise<
  | { ok: true; outcome: ReturnType<typeof interpretTikTokStatus>["outcome"]; published: false; externalCall: true; attempts: number }
  | { ok: false; reason: TikTokPostError; externalCall: boolean; attempts: number }
> {
  const liveEnabled = input.liveEnabled ?? TIKTOK_CONTENT_POSTING_LIVE;
  if (!input.capabilityEnabled) return { ok: false, reason: "capability_off", externalCall: false, attempts: 0 };
  if (!liveEnabled) return { ok: false, reason: "live_off", externalCall: false, attempts: 0 };
  if (!isTikTokPublishId(input.publishId) || !input.accessToken) {
    return { ok: false, reason: "unconfirmed", externalCall: false, attempts: 0 };
  }
  const called = await callWithRetry({
    kind: "status",
    http: input.http,
    request: {
      url: TIKTOK_STATUS_URL,
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publish_id: input.publishId }),
    },
  });
  if ("thrown" in called.result) {
    return { ok: false, reason: "network", externalCall: true, attempts: called.calls };
  }
  if (called.result.status === 429) {
    return { ok: false, reason: "rate_limited", externalCall: true, attempts: called.calls };
  }
  const data = called.result.body && typeof called.result.body === "object"
    ? (called.result.body as { data?: { status?: unknown } }).data
    : null;
  const status = text(data?.status);
  const code = errorCode(called.result.body);
  if (called.result.status < 200 || called.result.status >= 300 || (code && code !== "ok") || !status) {
    return { ok: false, reason: "unconfirmed", externalCall: true, attempts: called.calls };
  }
  const interpreted = interpretTikTokStatus(status);
  return {
    ok: true,
    outcome: interpreted.outcome,
    published: false,
    externalCall: true,
    attempts: called.calls,
  };
}

export function parseCreatorInfo(body: unknown): { ok: true; privacyOptions: string[] } | { ok: false; reason: "unconfirmed" } {
  if (!body || typeof body !== "object") return { ok: false, reason: "unconfirmed" };
  const code = errorCode(body);
  if (code && code !== "ok") return { ok: false, reason: "unconfirmed" };
  const data = (body as { data?: { privacy_level_options?: unknown } }).data;
  if (!data || !Array.isArray(data.privacy_level_options)) return { ok: false, reason: "unconfirmed" };
  const privacyOptions = data.privacy_level_options.filter((item): item is string => typeof item === "string");
  return { ok: true, privacyOptions };
}

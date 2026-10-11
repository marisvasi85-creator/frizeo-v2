import sharp from "sharp";
import { MARKETING_PUBLISH_BUCKET, STAGING_SUPABASE_HOST } from "@/lib/integrations/meta/publish/flags";

export const MAX_IMAGE_BYTES = 8_388_608;
const MIN_WIDTH = 320;
const MAX_WIDTH = 1440;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type PreparedImage =
  | { ok: true; jpeg: Buffer; width: number; height: number }
  | { ok: false; reason: "invalid_image" | "unsupported_type" };

export function marketingImagePath(tenantId: string, objectId: string): string | null {
  const tenant = tenantId.trim().toLowerCase();
  const object = objectId.trim().toLowerCase();
  if (!UUID_RE.test(tenant) || !UUID_RE.test(object)) return null;
  const path = `${tenant}/${object}.jpg`;
  if (path.includes("..") || path.includes("\\")) return null;
  return path;
}

export function pathBelongsToTenant(path: string, tenantId: string): boolean {
  const tenant = tenantId.trim().toLowerCase();
  if (!UUID_RE.test(tenant)) return false;
  return new RegExp(
    `^${tenant}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`,
  ).test(path);
}

export function sniffImageMime(bytes: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function aspectOk(width: number, height: number): boolean {
  if (width < MIN_WIDTH || height < 1) return false;
  if (width * 5 < height * 4) return false;
  if (width * 100 > height * 191) return false;
  return true;
}

async function encodeJpeg(input: Buffer, quality: number): Promise<{ jpeg: Buffer; width: number; height: number } | null> {
  try {
    const rendered = await sharp(input, {
      failOn: "error",
      animated: false,
      limitInputPixels: 16_000_000,
    })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .toColorspace("srgb")
      .jpeg({ quality, chromaSubsampling: "4:4:4" })
      .toBuffer({ resolveWithObject: true });
    return {
      jpeg: rendered.data,
      width: rendered.info.width,
      height: rendered.info.height,
    };
  } catch {
    return null;
  }
}

/**
 * Local JPEG conversion only. The second quality pass is not a Meta retry.
 */
export async function prepareMarketingImage(bytes: Buffer): Promise<PreparedImage> {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "invalid_image" };
  }
  if (!sniffImageMime(bytes)) return { ok: false, reason: "unsupported_type" };

  const first = await encodeJpeg(bytes, 85);
  if (!first) return { ok: false, reason: "invalid_image" };
  const encoded = first.jpeg.length > MAX_IMAGE_BYTES ? await encodeJpeg(bytes, 60) : first;
  if (!encoded || encoded.jpeg.length === 0 || encoded.jpeg.length > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "invalid_image" };
  }
  if (!aspectOk(encoded.width, encoded.height)) return { ok: false, reason: "invalid_image" };
  if (sniffImageMime(encoded.jpeg) !== "image/jpeg") return { ok: false, reason: "invalid_image" };
  return { ok: true, jpeg: encoded.jpeg, width: encoded.width, height: encoded.height };
}

export function isMetaFetchableImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.hostname !== STAGING_SUPABASE_HOST) return false;
  if (!url.pathname.startsWith(`/storage/v1/object/sign/${MARKETING_PUBLISH_BUCKET}/`)) {
    return false;
  }
  return true;
}

const HASHTAG_RE = /#[^\s#]+/g;
const MENTION_RE = /@[^\s@]+/g;

export function validateCaption(caption: string):
  | { ok: true; caption: string }
  | { ok: false; reason: "caption_too_long" | "too_many_hashtags" | "too_many_mentions" | "invalid_caption" } {
  if (caption.includes("\0")) return { ok: false, reason: "invalid_caption" };
  if (caption.length > 2200) return { ok: false, reason: "caption_too_long" };
  if ((caption.match(HASHTAG_RE) ?? []).length > 30) {
    return { ok: false, reason: "too_many_hashtags" };
  }
  if ((caption.match(MENTION_RE) ?? []).length > 20) {
    return { ok: false, reason: "too_many_mentions" };
  }
  return { ok: true, caption };
}

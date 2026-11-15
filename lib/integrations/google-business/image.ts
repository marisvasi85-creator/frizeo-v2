import sharp from "sharp";
import { MARKETING_PUBLISH_BUCKET, STAGING_SUPABASE_HOST } from "@/lib/integrations/meta/publish/flags";
import { pathBelongsToTenant, sniffImageMime } from "@/lib/integrations/meta/publish/image";

export const GOOGLE_IMAGE_MIN_BYTES = 10_240;
export const GOOGLE_IMAGE_MAX_BYTES = 5_242_880;
export const GOOGLE_IMAGE_MIN_EDGE = 250;
export const GOOGLE_IMAGE_SIGN_SECONDS = 1800;

const INPUT_MAX_BYTES = 8_388_608;

export function googleSignedImageUrl(value: string, tenantId: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password || url.hash) return null;
  if (url.hostname !== STAGING_SUPABASE_HOST) return null;
  const prefix = `/storage/v1/object/sign/${MARKETING_PUBLISH_BUCKET}/`;
  if (!url.pathname.startsWith(prefix)) return null;
  const objectPath = decodeURIComponent(url.pathname.slice(prefix.length));
  if (!pathBelongsToTenant(objectPath, tenantId)) return null;
  if (objectPath !== url.pathname.slice(prefix.length)) return null;
  const token = url.searchParams.get("token");
  if (!token || token.length < 20 || token.length > 4096) return null;
  if ([...url.searchParams.keys()].some((key) => key.toLowerCase() === "access_token")) return null;
  return url;
}

function edgeOk(width: number, height: number): boolean {
  return width >= GOOGLE_IMAGE_MIN_EDGE && height >= GOOGLE_IMAGE_MIN_EDGE
    && Math.min(width, height) >= GOOGLE_IMAGE_MIN_EDGE;
}

function sizeOk(bytes: number): boolean {
  return bytes >= GOOGLE_IMAGE_MIN_BYTES && bytes <= GOOGLE_IMAGE_MAX_BYTES;
}

async function encodeJpeg(input: Buffer, quality: number): Promise<{ jpeg: Buffer; width: number; height: number } | null> {
  try {
    const rendered = await sharp(input, {
      failOn: "error",
      animated: false,
      limitInputPixels: 16_000_000,
    })
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
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
 * Converts one selected photo to a JPEG Google can fetch.
 * Does not change the Meta image rules.
 */
export async function prepareGooglePostImage(bytes: Buffer): Promise<
  | { ok: true; jpeg: Buffer; width: number; height: number }
  | { ok: false; reason: "invalid_image" | "unsupported_type" }
> {
  if (bytes.length === 0 || bytes.length > INPUT_MAX_BYTES) return { ok: false, reason: "invalid_image" };
  if (!sniffImageMime(bytes)) return { ok: false, reason: "unsupported_type" };
  const first = await encodeJpeg(bytes, 85);
  if (!first) return { ok: false, reason: "invalid_image" };
  const encoded = first.jpeg.length > GOOGLE_IMAGE_MAX_BYTES ? await encodeJpeg(bytes, 60) : first;
  if (!encoded || !sizeOk(encoded.jpeg.length) || !edgeOk(encoded.width, encoded.height)) {
    return { ok: false, reason: "invalid_image" };
  }
  if (sniffImageMime(encoded.jpeg) !== "image/jpeg") return { ok: false, reason: "invalid_image" };
  return { ok: true, jpeg: encoded.jpeg, width: encoded.width, height: encoded.height };
}

export async function readGoogleJpeg(bytes: Buffer): Promise<
  | { ok: true; width: number; height: number }
  | { ok: false; reason: "invalid_image" }
> {
  if (!sizeOk(bytes.length) || sniffImageMime(bytes) !== "image/jpeg") {
    return { ok: false, reason: "invalid_image" };
  }
  try {
    const metadata = await sharp(bytes, { failOn: "error", animated: false }).metadata();
    if (!metadata.width || !metadata.height || !edgeOk(metadata.width, metadata.height)) {
      return { ok: false, reason: "invalid_image" };
    }
    if (metadata.format !== "jpeg") return { ok: false, reason: "invalid_image" };
    return { ok: true, width: metadata.width, height: metadata.height };
  } catch {
    return { ok: false, reason: "invalid_image" };
  }
}

export async function resolveGooglePostImage(input: {
  tenantId: string;
  mediaObjectPath: string;
  sign: (path: string) => Promise<string | null>;
  probe: (url: string) => Promise<{ status: number; contentType: string | null; bytes: Buffer } | null>;
}): Promise<{ ok: true; sourceUrl: string } | { ok: false; reason: "invalid_image" }> {
  if (!pathBelongsToTenant(input.mediaObjectPath, input.tenantId)) {
    return { ok: false, reason: "invalid_image" };
  }
  const signed = await input.sign(input.mediaObjectPath);
  if (!signed) return { ok: false, reason: "invalid_image" };
  const url = googleSignedImageUrl(signed, input.tenantId);
  if (!url) return { ok: false, reason: "invalid_image" };
  const probed = await input.probe(url.toString());
  if (!probed || probed.status !== 200) return { ok: false, reason: "invalid_image" };
  const type = probed.contentType?.toLowerCase() ?? "";
  if (!type.startsWith("image/jpeg")) return { ok: false, reason: "invalid_image" };
  const inspected = await readGoogleJpeg(probed.bytes);
  if (!inspected.ok) return { ok: false, reason: "invalid_image" };
  return { ok: true, sourceUrl: url.toString() };
}

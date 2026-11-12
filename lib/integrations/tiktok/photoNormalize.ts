import sharp from "sharp";

export const TIKTOK_PHOTO_MAX_SHORT_SIDE = 1080;
export const TIKTOK_PHOTO_MAX_LONG_SIDE = 1920;
export const TIKTOK_PHOTO_MAX_BYTES = 20 * 1024 * 1024;

const INPUT_FORMATS = new Set(["jpeg", "webp", "png"]);

export function tikTokPhotoBox(width: number, height: number): { width: number; height: number } {
  if (width >= height) {
    return { width: TIKTOK_PHOTO_MAX_LONG_SIDE, height: TIKTOK_PHOTO_MAX_SHORT_SIDE };
  }
  return { width: TIKTOK_PHOTO_MAX_SHORT_SIDE, height: TIKTOK_PHOTO_MAX_LONG_SIDE };
}

export function tikTokPhotoFrame(width: number, height: number): { width: number; height: number } | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return null;
  const box = tikTokPhotoBox(width, height);
  const scale = Math.min(1, box.width / width, box.height / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function isOutputJpeg(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function normalizeTikTokPhoto(bytes: Buffer): Promise<Buffer | null> {
  if (bytes.length === 0 || bytes.length > TIKTOK_PHOTO_MAX_BYTES) return null;
  let meta: sharp.Metadata;
  try {
    meta = await sharp(bytes, { failOn: "error" }).rotate().metadata();
  } catch {
    return null;
  }
  if (!meta.width || !meta.height || !meta.format || !INPUT_FORMATS.has(meta.format)) return null;
  const box = tikTokPhotoBox(meta.width, meta.height);
  let quality = 90;
  let output: Buffer | null = null;
  while (quality >= 50) {
    try {
      output = await sharp(bytes, { failOn: "error" })
        .rotate()
        .resize(box.width, box.height, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
        .toBuffer();
    } catch {
      return null;
    }
    if (output.length <= TIKTOK_PHOTO_MAX_BYTES && isOutputJpeg(output)) return output;
    quality -= 10;
  }
  return null;
}

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ValidatedImage = {
  bytes: Buffer;
  contentType: keyof typeof IMAGE_TYPES;
  extension: (typeof IMAGE_TYPES)[keyof typeof IMAGE_TYPES];
};

function detectImageContentType(
  bytes: Buffer,
): keyof typeof IMAGE_TYPES | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp") {
    const brand = bytes.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis" || brand === "mif1") {
      return "image/avif";
    }
  }

  return null;
}

export async function validateImageUpload(file: File): Promise<ValidatedImage> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selectează o imagine validă.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Imaginea poate avea maximum 5 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = detectImageContentType(bytes);

  if (!contentType) {
    throw new Error("Sunt acceptate doar imagini JPG, PNG, WebP sau AVIF.");
  }

  // Reject spoofed Content-Type that disagrees with magic bytes.
  if (file.type && file.type !== contentType && file.type in IMAGE_TYPES) {
    throw new Error("Tipul fișierului nu corespunde conținutului imaginii.");
  }

  return {
    bytes,
    contentType,
    extension: IMAGE_TYPES[contentType],
  };
}

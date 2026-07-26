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

export async function validateImageUpload(file: File): Promise<ValidatedImage> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selectează o imagine validă.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Imaginea poate avea maximum 5 MB.");
  }

  if (!(file.type in IMAGE_TYPES)) {
    throw new Error("Sunt acceptate doar imagini JPG, PNG, WebP sau AVIF.");
  }

  const contentType = file.type as keyof typeof IMAGE_TYPES;

  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    contentType,
    extension: IMAGE_TYPES[contentType],
  };
}

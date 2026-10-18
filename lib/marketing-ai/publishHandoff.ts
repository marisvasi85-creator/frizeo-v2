const HANDOFF_KEY = "frizeo.marketing.publish.handoff.v1";
const MAX_IMAGE_BYTES = 1_500_000;

export type MarketingPublishHandoff = {
  caption: string;
  fileName: string;
  mimeType: "image/png" | "image/jpeg";
  imageBase64: string;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function fileNameFor(mimeType: MarketingPublishHandoff["mimeType"]): string {
  return mimeType === "image/jpeg" ? "marketing-ai.jpg" : "marketing-ai.png";
}

export function writeMarketingPublishHandoff(
  storage: StorageLike,
  input: {
    caption: string;
    bytes: Uint8Array;
    mimeType: MarketingPublishHandoff["mimeType"];
  },
): boolean {
  if (input.bytes.length === 0 || input.bytes.length > MAX_IMAGE_BYTES) return false;
  if (input.caption.length > 2200) return false;
  const payload: MarketingPublishHandoff = {
    caption: input.caption,
    fileName: fileNameFor(input.mimeType),
    mimeType: input.mimeType,
    imageBase64: bytesToBase64(input.bytes),
  };
  try {
    storage.setItem(HANDOFF_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function takeMarketingPublishHandoff(storage: StorageLike): MarketingPublishHandoff | null {
  const raw = storage.getItem(HANDOFF_KEY);
  storage.removeItem(HANDOFF_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MarketingPublishHandoff>;
    if (parsed.mimeType !== "image/png" && parsed.mimeType !== "image/jpeg") return null;
    if (typeof parsed.caption !== "string" || typeof parsed.imageBase64 !== "string") return null;
    const bytes = base64ToBytes(parsed.imageBase64);
    if (!bytes || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
    return {
      caption: parsed.caption,
      fileName: fileNameFor(parsed.mimeType),
      mimeType: parsed.mimeType,
      imageBase64: parsed.imageBase64,
    };
  } catch {
    return null;
  }
}

export function saveMarketingPublishHandoff(input: {
  caption: string;
  bytes: Uint8Array;
  mimeType: MarketingPublishHandoff["mimeType"];
}): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return writeMarketingPublishHandoff(sessionStorage, input);
}

export function readMarketingPublishHandoff(): MarketingPublishHandoff | null {
  if (typeof sessionStorage === "undefined") return null;
  return takeMarketingPublishHandoff(sessionStorage);
}

import sharp from "sharp";
import type { InstagramListedPost } from "@/lib/integrations/meta/publish/instagram";
import {
  captionsMatch,
  instagramPostInWindow,
  matchInstagramPosts,
  type RankedInstagramPost,
} from "@/lib/integrations/meta/publish/instagramMatch";

const MAX_IMAGE_BYTES = 2_000_000;
const MAX_IMAGE_FETCHES = 4;

export function hashDistance(left: bigint, right: bigint): number {
  let value = left ^ right;
  let bits = 0;
  const one = BigInt(1);
  while (value > BigInt(0)) {
    bits += Number(value & one);
    value >>= one;
  }
  return bits;
}

export async function averageHash(bytes: Buffer): Promise<bigint | null> {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  try {
    const raw = await sharp(bytes, {
      failOn: "error",
      animated: false,
      limitInputPixels: 8_000_000,
    })
      .rotate()
      .resize(8, 8, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();
    if (raw.length < 64) return null;
    let sum = 0;
    for (let index = 0; index < 64; index += 1) sum += raw[index];
    const average = sum / 64;
    let bits = BigInt(0);
    const one = BigInt(1);
    for (let index = 0; index < 64; index += 1) {
      if (raw[index] >= average) bits |= one << BigInt(index);
    }
    return bits;
  } catch {
    return null;
  }
}

export function isInstagramCdnUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return host === "cdninstagram.com" ||
    host.endsWith(".cdninstagram.com") ||
    host === "fbcdn.net" ||
    host.endsWith(".fbcdn.net");
}

function closeness(timestamp: string | null, createdAt: string): number {
  const post = Date.parse(timestamp ?? "");
  const created = Date.parse(createdAt);
  if (!Number.isFinite(post) || !Number.isFinite(created)) return Number.POSITIVE_INFINITY;
  return Math.abs(post - created);
}

export async function fetchInstagramCdnImage(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer | null> {
  let current = url;
  const deadline = Date.now() + timeoutMs;
  try {
    for (let hop = 0; hop < 3; hop += 1) {
      if (!isInstagramCdnUrl(current)) return null;
      const remaining = deadline - Date.now();
      if (remaining < 100) return null;
      const response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(remaining),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }
      if (!response.ok) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
      return bytes;
    }
  } catch {
    return null;
  }
  return null;
}

export async function rankInstagramPosts(input: {
  caption: string;
  createdAt: string;
  updatedAt: string;
  localImage: Buffer | null;
  posts: InstagramListedPost[];
  fetchImage: (url: string) => Promise<Buffer | null>;
}): Promise<{ found: true; providerPostId: string } | { found: false; reason: "none" | "several" }> {
  const localHash = input.localImage ? await averageHash(input.localImage) : null;
  const ordered = [...input.posts].sort((left, right) => {
    const captionRank = Number(captionsMatch(input.caption, right.caption)) -
      Number(captionsMatch(input.caption, left.caption));
    return captionRank || closeness(left.timestamp, input.createdAt) - closeness(right.timestamp, input.createdAt);
  });
  const distances = new Map<string, number | null>();
  let fetched = 0;
  for (const post of ordered) {
    if (
      !localHash ||
      !post.mediaUrl ||
      fetched >= MAX_IMAGE_FETCHES ||
      !instagramPostInWindow(post.timestamp, input.createdAt, input.updatedAt)
    ) {
      distances.set(post.id, null);
      continue;
    }
    fetched += 1;
    const remote = await input.fetchImage(post.mediaUrl);
    const remoteHash = remote ? await averageHash(remote) : null;
    distances.set(post.id, remoteHash == null ? null : hashDistance(localHash, remoteHash));
  }
  const ranked: RankedInstagramPost[] = input.posts.map((post) => ({
    id: post.id,
    caption: post.caption,
    timestamp: post.timestamp,
    mediaType: post.mediaType,
    imageDistance: distances.get(post.id) ?? null,
  }));
  return matchInstagramPosts({
    caption: input.caption,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    posts: ranked,
  });
}

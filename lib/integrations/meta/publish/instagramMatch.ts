export const INSTAGRAM_LOOKUP_BEFORE_MS = 10 * 60 * 1000;
export const INSTAGRAM_LOOKUP_AFTER_MS = 2 * 60 * 60 * 1000;
export const INSTAGRAM_IMAGE_MATCH_MAX_DISTANCE = 10;
export const INSTAGRAM_IMAGE_REJECT_MIN_DISTANCE = 18;
export const INSTAGRAM_NOT_FOUND = "Nu a fost găsită";

export type RankedInstagramPost = {
  id: string;
  caption: string;
  timestamp: string | null;
  mediaType: string | null;
  imageDistance: number | null;
};

export function normalizeCaption(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function captionsMatch(jobCaption: string, postCaption: string): boolean {
  const expected = normalizeCaption(jobCaption);
  if (!expected) return false;
  return expected === normalizeCaption(postCaption);
}

export function instagramPostInWindow(
  timestamp: string | null,
  createdAt: string,
  updatedAt: string,
): boolean {
  const post = Date.parse(timestamp ?? "");
  const created = Date.parse(createdAt);
  const updated = Date.parse(updatedAt);
  if (!Number.isFinite(post) || !Number.isFinite(created)) return false;
  const endBase = Number.isFinite(updated) ? Math.max(updated, created) : created;
  return post >= created - INSTAGRAM_LOOKUP_BEFORE_MS && post <= endBase + INSTAGRAM_LOOKUP_AFTER_MS;
}

function comparable(post: RankedInstagramPost): boolean {
  return post.mediaType == null || post.mediaType === "IMAGE" || post.mediaType === "CAROUSEL_ALBUM";
}

/**
 * A match needs the job's time window and either the same caption or the same image.
 * A caption hit is dropped when the image is clearly different. Several hits stay unresolved.
 */
export function matchInstagramPosts(input: {
  caption: string;
  createdAt: string;
  updatedAt: string;
  posts: RankedInstagramPost[];
}): { found: true; providerPostId: string } | { found: false; reason: "none" | "several" } {
  const accepted: string[] = [];
  for (const post of input.posts) {
    if (!/^[0-9]{1,32}$/.test(post.id)) continue;
    if (!comparable(post)) continue;
    if (!instagramPostInWindow(post.timestamp, input.createdAt, input.updatedAt)) continue;
    const captionHit = captionsMatch(input.caption, post.caption);
    const imageHit = post.imageDistance != null && post.imageDistance <= INSTAGRAM_IMAGE_MATCH_MAX_DISTANCE;
    const imageMiss = post.imageDistance != null && post.imageDistance >= INSTAGRAM_IMAGE_REJECT_MIN_DISTANCE;
    if ((captionHit && !imageMiss) || imageHit) accepted.push(post.id);
  }
  if (accepted.length === 1) return { found: true, providerPostId: accepted[0] };
  if (accepted.length > 1) return { found: false, reason: "several" };
  return { found: false, reason: "none" };
}

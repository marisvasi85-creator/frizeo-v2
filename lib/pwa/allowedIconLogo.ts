const ALLOWED_BUCKETS = new Set(["salon-logos", "barber-avatars"]);

/**
 * Only Frizeo storage public URLs may be inlined into generated PWA icons (SSRF-safe).
 */
export function isAllowedPwaLogoUrl(raw: string | null | undefined): boolean {
  const value = raw?.trim();
  if (!value) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (!host.endsWith(".supabase.co") && host !== "supabase.co") {
    return false;
  }

  const match = url.pathname.match(
    /^\/storage\/v1\/object\/public\/([^/]+)\//,
  );
  if (!match) return false;

  return ALLOWED_BUCKETS.has(decodeURIComponent(match[1]));
}

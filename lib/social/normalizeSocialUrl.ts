export type SocialPlatform = "instagram" | "facebook" | "tiktok";

const HOST_PATTERNS: Record<SocialPlatform, RegExp> = {
  instagram: /(^|\.)instagram\.com$/i,
  facebook: /(^|\.)(facebook|fb)\.com$/i,
  tiktok: /(^|\.)tiktok\.com$/i,
};

function parseUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

export function normalizeSocialUrl(
  platform: SocialPlatform,
  value: string | null | undefined,
): { url: string | null; error?: string } {
  if (!value?.trim()) {
    return { url: null };
  }

  const parsed = parseUrl(value);
  if (!parsed) {
    return { url: null, error: "Link invalid." };
  }

  if (!HOST_PATTERNS[platform].test(parsed.hostname)) {
    const labels: Record<SocialPlatform, string> = {
      instagram: "Instagram",
      facebook: "Facebook",
      tiktok: "TikTok",
    };
    return {
      url: null,
      error: `Linkul trebuie să fie de pe ${labels[platform]}.`,
    };
  }

  parsed.protocol = "https:";
  return { url: parsed.toString() };
}

export type SocialLinks = {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
};

export function countSocialLinks(links: SocialLinks): number {
  return [links.instagram, links.facebook, links.tiktok].filter(Boolean).length;
}

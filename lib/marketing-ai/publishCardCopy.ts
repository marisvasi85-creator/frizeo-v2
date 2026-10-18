import { buildShareCaption } from "@/lib/marketing-ai/share";

const PUBLIC_BOOKING_HOSTS = new Set(["frizeo.ro", "www.frizeo.ro"]);

export type PublishImageCopy = {
  title: string;
  content: string;
  callToAction: string;
  bookingUrl?: string;
};

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space >= Math.floor(max / 2) ? cut.slice(0, space) : cut).replace(/[.,:;–\-]+$/, "").trim();
}

function withoutUrls(value: string): string {
  return value.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
}

/** A public booking URL already stored for this salon. Staging and other hosts are omitted, not rewritten. */
export function bookingLinkForRealPublish(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!PUBLIC_BOOKING_HOSTS.has(host)) return null;
  const path = url.pathname.replace(/\/+$/, "");
  if (!/^\/booking\/[^/]+/.test(path)) return null;
  return `${url.origin}${path}${url.search}`;
}

export function publishImageCopy(input: {
  title: string;
  content: string;
  callToAction: string;
  bookingUrl?: string | null;
}): PublishImageCopy {
  const benefits = input.content
    .replace(/https?:\/\/\S+/g, " ")
    .split(/\n+|•|(?<=[.!?])\s+/)
    .map((part) => part.replace(/^[-*–]+\s*/, "").replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim())
    .filter((part) => {
      const words = part.split(" ").filter(Boolean);
      return part.length >= 3 && part.length <= 72 && words.length <= 12;
    })
    .slice(0, 3);
  const callToAction = clip(withoutUrls(input.callToAction), 42) || "Programează-te";
  const bookingUrl = bookingLinkForRealPublish(input.bookingUrl);
  return {
    title: clip(withoutUrls(input.title), 48) || "Programare",
    content: benefits.join(" · "),
    callToAction,
    ...(bookingUrl ? { bookingUrl } : {}),
  };
}

export function publishCaption(input: {
  content: string;
  callToAction: string;
  hashtags?: string[];
  bookingUrl?: string | null;
}): string {
  return buildShareCaption({
    content: input.content,
    callToAction: input.callToAction,
    hashtags: input.hashtags,
    bookingUrl: bookingLinkForRealPublish(input.bookingUrl),
  })
    .replace(/https?:\/\/staging\.frizeo\.ro\S*/gi, "")
    .replace(/https?:\/\/[^\s/]+\.vercel\.app\S*/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

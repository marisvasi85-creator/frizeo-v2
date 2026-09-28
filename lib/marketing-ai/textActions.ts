import type { MarketingChannel } from "./channels";
import { channelUsesFullBookingUrl } from "./channels";

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const PRICE_RE = /\b\d+([.,]\d+)?\s*(lei|ron)\b/gi;

export type MarketingDraft = {
  title: string;
  content: string;
  hashtags: string[];
  callToAction: string;
};

function collapse(text: string): string {
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function makeShorter(draft: MarketingDraft): MarketingDraft {
  const paragraphs = draft.content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const short = paragraphs.slice(0, 2).join("\n\n");
  const clipped = short.length > 280 ? `${short.slice(0, 277).trimEnd()}…` : short;
  return { ...draft, content: clipped || draft.content };
}

export function makeDirect(draft: MarketingDraft): MarketingDraft {
  const line =
    draft.content
      .split(/\n+/)
      .map((part) => part.trim())
      .find(Boolean) || draft.content.trim();
  return {
    ...draft,
    content: line,
    callToAction: draft.callToAction.trim(),
  };
}

export function removePrices(draft: MarketingDraft): MarketingDraft {
  const strip = (value: string) =>
    collapse(value.replace(PRICE_RE, "").replace(/\s{2,}/g, " "));
  return {
    ...draft,
    content: strip(draft.content),
    callToAction: strip(draft.callToAction),
  };
}

export function removeEmoji(draft: MarketingDraft): MarketingDraft {
  const strip = (value: string) =>
    collapse(value.replace(EMOJI_RE, "").replace(/[ \t]{2,}/g, " "));
  return {
    ...draft,
    title: strip(draft.title),
    content: strip(draft.content),
    callToAction: strip(draft.callToAction),
  };
}

export function addLightEmoji(draft: MarketingDraft): MarketingDraft {
  if (EMOJI_RE.test(draft.content)) {
    EMOJI_RE.lastIndex = 0;
    return draft;
  }
  EMOJI_RE.lastIndex = 0;
  return {
    ...draft,
    content: `✂️ ${draft.content.trim()}`,
  };
}

export function asLinkInBio(draft: MarketingDraft, bookingUrl?: string | null): MarketingDraft {
  return {
    ...draft,
    content: stripUrls(draft.content, bookingUrl),
    callToAction: "Link în bio — programează-te online.",
  };
}

export function asWhatsApp(
  draft: MarketingDraft,
  bookingUrl?: string | null,
): MarketingDraft {
  const url = bookingUrl?.trim();
  const content = draft.content.trim();
  const already = url && (content.includes(url) || draft.callToAction.includes(url));
  return {
    ...draft,
    callToAction: url
      ? already
        ? draft.callToAction
        : `Programează-te aici: ${url}`
      : draft.callToAction,
  };
}

function stripUrls(text: string, bookingUrl?: string | null): string {
  let next = text;
  if (bookingUrl) next = next.split(bookingUrl).join("");
  return collapse(next.replace(/https?:\/\/\S+/g, ""));
}

export function applyTextAction(
  action: string,
  draft: MarketingDraft,
  bookingUrl?: string | null,
): MarketingDraft | null {
  switch (action) {
    case "shorter":
      return makeShorter(draft);
    case "direct":
      return makeDirect(draft);
    case "no_price":
      return removePrices(draft);
    case "no_emoji":
      return removeEmoji(draft);
    case "emoji":
      return addLightEmoji(draft);
    case "link_in_bio":
      return asLinkInBio(draft, bookingUrl);
    case "whatsapp":
      return asWhatsApp(draft, bookingUrl);
    default:
      return null;
  }
}

export function ctaForChannel(
  channel: MarketingChannel,
  trackedUrl: string | null,
): string {
  if (channelUsesFullBookingUrl(channel) && trackedUrl) {
    return `Programează-te aici: ${trackedUrl}`;
  }
  if (channel === "story") return "Link în story — programează-te.";
  if (channel === "reel" || channel === "tiktok") {
    return "Link în bio — programează-te.";
  }
  return "Link în bio — programează-te online.";
}

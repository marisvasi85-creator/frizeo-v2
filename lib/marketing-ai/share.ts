export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildShareCaption(input: {
  content: string;
  callToAction: string;
  hashtags?: string[];
  bookingUrl?: string | null;
}): string {
  const tags = (input.hashtags || []).length
    ? `\n\n${input.hashtags!
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
        .join(" ")}`
    : "";

  const parts = [input.content.trim(), input.callToAction.trim()];

  if (
    input.bookingUrl &&
    !input.callToAction.includes(input.bookingUrl) &&
    !input.content.includes(input.bookingUrl)
  ) {
    parts.push(input.bookingUrl);
  }

  return `${parts.filter(Boolean).join("\n\n")}${tags}`;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "absolute";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

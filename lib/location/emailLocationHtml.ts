import type { ResolvedLocation } from "./types";

export function locationEmailHtml(
  location: ResolvedLocation | null | undefined,
): string {
  if (!location?.formattedAddress && !location?.mapsUrl) {
    return "";
  }

  const addressBlock = location.formattedAddress
    ? `<p><strong>Locație:</strong> ${location.formattedAddress}</p>`
    : "";

  const buttons: string[] = [];

  if (location.mapsUrl) {
    buttons.push(
      `<a href="${location.mapsUrl}" style="display:inline-block;margin-right:8px;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Google Maps</a>`,
    );
  }

  if (location.wazeUrl) {
    buttons.push(
      `<a href="${location.wazeUrl}" style="display:inline-block;padding:10px 16px;background:#33ccff;color:#111;text-decoration:none;border-radius:6px;">Waze</a>`,
    );
  }

  const buttonsBlock =
    buttons.length > 0
      ? `<p style="margin-top:12px;">${buttons.join("")}</p>`
      : "";

  return `
    <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:20px 0;">
      ${addressBlock}
      ${buttonsBlock}
    </div>
  `;
}

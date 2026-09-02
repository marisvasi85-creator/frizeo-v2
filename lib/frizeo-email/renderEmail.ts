import type { MarketingEmailContent } from "@/lib/frizeo-email/types";

export type RenderMarketingEmailInput = MarketingEmailContent & {
  unsubscribeUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safePublicUrl(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function textToHtml(value: string): string {
  const escaped = escapeHtml(value).replace(/\r?\n/g, "<br>");
  return escaped.replace(
    /https?:\/\/[^\s<]+/gi,
    (raw) => {
      const decoded = raw.replaceAll("&amp;", "&");
      const safe = safePublicUrl(decoded);
      if (!safe) return raw;
      return `<a href="${escapeHtml(safe)}" style="color:#111111;text-decoration:underline;word-break:break-all;">${escapeHtml(safe)}</a>`;
    },
  );
}

/**
 * Small table-based template with inline styles for Gmail, Outlook and Apple Mail.
 * All editable values are escaped; only validated http(s) URLs reach attributes.
 */
export function renderMarketingEmail(input: RenderMarketingEmailInput): string {
  const imageUrl = safePublicUrl(input.image_url);
  const ctaUrl = safePublicUrl(input.cta_url);
  const unsubscribeUrl = safePublicUrl(input.unsubscribeUrl) ?? "https://email.frizeo.ro";
  const showCta = Boolean(input.cta_text?.trim() && ctaUrl);

  return `<!doctype html>
<html lang="ro">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(input.subject || "Frizeo")}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .frizeo-shell { width: 100% !important; }
        .frizeo-pad { padding-left: 22px !important; padding-right: 22px !important; }
        .frizeo-title { font-size: 28px !important; line-height: 34px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;color:#171717;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preview_text)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="frizeo-shell" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;">
            <tr>
              <td class="frizeo-pad" style="padding:30px 38px 20px;background:#0b0b0c;color:#ffffff;">
                <div style="font-size:25px;font-weight:800;letter-spacing:-0.5px;">Frizeo</div>
              </td>
            </tr>
            ${imageUrl ? `<tr><td><img src="${escapeHtml(imageUrl)}" width="600" alt="" style="display:block;width:100%;height:auto;border:0;"></td></tr>` : ""}
            <tr>
              <td class="frizeo-pad" style="padding:38px 38px 32px;">
                ${input.heading.trim() ? `<h1 class="frizeo-title" style="margin:0 0 20px;font-size:34px;line-height:40px;letter-spacing:-0.7px;color:#111111;">${escapeHtml(input.heading)}</h1>` : ""}
                <div style="font-size:16px;line-height:26px;color:#393939;">${textToHtml(input.body_text)}</div>
                ${showCta ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;"><tr><td bgcolor="#111111" style="border-radius:10px;"><a href="${escapeHtml(ctaUrl!)}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">${escapeHtml(input.cta_text!.trim())}</a></td></tr></table>` : ""}
              </td>
            </tr>
            <tr>
              <td class="frizeo-pad" style="padding:24px 38px 30px;background:#f8f8f8;border-top:1px solid #eeeeee;font-size:12px;line-height:19px;color:#707070;">
                ${input.footer_text.trim() ? `<div style="margin-bottom:10px;">${textToHtml(input.footer_text)}</div>` : ""}
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#525252;text-decoration:underline;">Dezabonare</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderMarketingEmailText(
  input: RenderMarketingEmailInput,
): string {
  const parts = [
    input.heading.trim(),
    input.body_text.trim(),
    input.cta_text?.trim() && input.cta_url?.trim()
      ? `${input.cta_text.trim()}: ${input.cta_url.trim()}`
      : "",
    input.footer_text.trim(),
    `Dezabonare: ${input.unsubscribeUrl}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

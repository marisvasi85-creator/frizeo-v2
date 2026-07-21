type Props = {
  salonName: string;
  trialEndsLabel: string;
  planName: string | null;
  bodyText: string;
};

export function trialFollowupTemplate({
  salonName,
  trialEndsLabel,
  planName,
  bodyText,
}: Props) {
  const paragraphs = bodyText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <h2 style="margin-bottom:8px;">Frizeo — trial ${salonName}</h2>
      <p style="color:#666;font-size:14px;margin-top:0;">
        Expiră pe ${trialEndsLabel}${planName ? ` · ${planName}` : ""}
      </p>
      ${paragraphs.map((p) => `<p style="line-height:1.5;white-space:pre-wrap;">${escapeHtml(p)}</p>`).join("")}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="color:#666;font-size:12px;">
        Maris · Frizeo.ro
      </p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

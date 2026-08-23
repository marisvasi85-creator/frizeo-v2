export const CLIENT_ACCESS_APPROVED_SUBJECT =
  "Cererea ta a fost acceptată";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[char] ?? char;
  });
}

export function clientAccessApprovedEmailHtml(input: {
  clientName: string;
  barberName: string;
  bookingUrl: string;
}): string {
  const safeBookingUrl = escapeHtml(input.bookingUrl);
  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px;color:#111;">
      <h2 style="margin:0 0 16px;color:#111;">Acum te poți programa</h2>
      <p>Bună, ${escapeHtml(input.clientName)}.</p>
      <p>
        Cererea ta de acces la ${escapeHtml(input.barberName)} a fost acceptată.
        Folosește același număr de telefon când faci programarea.
      </p>
      <p style="margin:24px 0;">
        <a href="${safeBookingUrl}" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">
          Programează-te
        </a>
      </p>
      <p style="font-size:13px;color:#666;word-break:break-all;">
        ${safeBookingUrl}
      </p>
      <hr style="margin:30px 0;border:0;border-top:1px solid #e5e5e5;" />
      <p style="font-size:12px;color:#aaa;">Frizeo • Sistem programări</p>
    </div>
  `;
}

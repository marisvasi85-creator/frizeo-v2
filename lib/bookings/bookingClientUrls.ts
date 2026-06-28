import { getAppUrl } from "@/lib/app/getAppUrl";

type BookingTokens = {
  cancel_token?: string | null;
  reschedule_token?: string | null;
};

export function bookingClientUrls(booking: BookingTokens) {
  const base = getAppUrl().replace(/\/$/, "");

  return {
    cancelUrl: `${base}/cancel/${booking.cancel_token}`,
    rescheduleUrl: `${base}/reschedule/${booking.reschedule_token}`,
  };
}

export function bookingActionButtonsHtml(
  cancelUrl: string,
  rescheduleUrl: string
): string {
  return `
      <div style="margin:20px 0;">
        <a href="${rescheduleUrl}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block; padding:10px 15px; background:#111; color:#fff; text-decoration:none; border-radius:6px; margin-right:10px;">
          Modifică programarea
        </a>

        <a href="${cancelUrl}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block; padding:10px 15px; background:#e53935; color:#fff; text-decoration:none; border-radius:6px;">
          Anulează programarea
        </a>
      </div>

      <p>Dacă nu funcționează butoanele:</p>

      <p>
        Reprogramare:<br/>
        <a href="${rescheduleUrl}">${rescheduleUrl}</a>
      </p>

      <p>
        Anulare:<br/>
        <a href="${cancelUrl}">${cancelUrl}</a>
      </p>
  `;
}

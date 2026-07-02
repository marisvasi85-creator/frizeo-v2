import { bookingActionButtonsHtml } from "@/lib/bookings/bookingClientUrls";
import { locationEmailHtml } from "@/lib/location/emailLocationHtml";
import type { ResolvedLocation } from "@/lib/location/types";

type RescheduleConfirmationArgs = {
  barberName: string;
  date: string;
  time: string;
  cancelUrl: string;
  rescheduleUrl: string;
  location?: ResolvedLocation | null;
};

export function rescheduleConfirmationTemplate({
  barberName,
  date,
  time,
  cancelUrl,
  rescheduleUrl,
  location,
}: RescheduleConfirmationArgs) {
  const formattedTime = time.slice(0, 5);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px;">
      <h2 style="color: #111;">Programare reprogramată</h2>

      <p>Salut,</p>

      <p>
        Programarea ta la <strong>${barberName}</strong> a fost
        <strong>reprogramată cu succes</strong>.
      </p>

      <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:20px 0;">
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Ora:</strong> ${formattedTime}</p>
      </div>

      ${locationEmailHtml(location)}

      <p>Poți modifica din nou sau anula programarea:</p>

      ${bookingActionButtonsHtml(cancelUrl, rescheduleUrl)}

      <p style="font-size:12px; color:#aaa;">Frizeo • Sistem programări</p>
    </div>
  `;
}

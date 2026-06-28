import { bookingActionButtonsHtml } from "@/lib/bookings/bookingClientUrls";

export function clientConfirmationTemplate({
  clientName,
  barberName,
  serviceName,
  date,
  time,
  cancelUrl,
  rescheduleUrl,
}: {
  clientName: string;
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
  cancelUrl: string;
  rescheduleUrl: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px;">
      <h2 style="color: #111;">Programare confirmată</h2>

      <p>Salut <strong>${clientName}</strong>,</p>

      <p>Programarea ta a fost confirmată cu succes.</p>

      <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:20px 0;">
        <p><strong>Frizer:</strong> ${barberName}</p>
        <p><strong>Serviciu:</strong> ${serviceName}</p>
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Ora:</strong> ${time}</p>
      </div>

      <p>Dacă ai nevoie să modifici sau să anulezi programarea:</p>

      ${bookingActionButtonsHtml(cancelUrl, rescheduleUrl)}

      <p style="font-size:12px; color:#777;">
        Dacă nu ai făcut tu această programare, ignoră acest mesaj.
      </p>

      <hr style="margin:30px 0;" />

      <p style="font-size:12px; color:#aaa;">
        Frizeo • Sistem programări
      </p>
    </div>
  `;
}

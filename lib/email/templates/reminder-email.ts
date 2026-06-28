import { bookingActionButtonsHtml } from "@/lib/bookings/bookingClientUrls";

export function reminderEmailTemplate({
  time,
  cancelUrl,
  rescheduleUrl,
}: {
  time: string;
  cancelUrl: string;
  rescheduleUrl: string;
}) {
  const formattedTime = time.slice(0, 5);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px;">
      <h2 style="color: #111;">Ne vedem în curând</h2>

      <p>
        Acesta este un reminder că ai o programare astăzi la ora
        <strong>${formattedTime}</strong>.
      </p>

      <p>Te rugăm să ajungi cu câteva minute înainte.</p>

      <p>Dacă nu mai poți ajunge, poți reprograma sau anula:</p>

      ${bookingActionButtonsHtml(cancelUrl, rescheduleUrl)}

      <p style="font-size:12px; color:#aaa;">Frizeo • Sistem programări</p>
    </div>
  `;
}

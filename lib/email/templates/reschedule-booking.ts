type RescheduleBookingArgs = {
  clientName: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  cancelUrl: string;
};

export function rescheduleBookingTemplate({
  clientName,
  oldDate,
  oldTime,
  newDate,
  newTime,
  cancelUrl,
}: RescheduleBookingArgs) {
  return `
    <h2>Salut ${clientName} 👋</h2>

    <p>Programarea ta a fost <strong>reprogramată</strong>.</p>

    <h3>⛔ Programare veche</h3>
    <p>
      📅 <strong>${oldDate}</strong><br/>
      ⏰ <strong>${oldTime}</strong>
    </p>

    <h3>✅ Programare nouă</h3>
    <p>
      📅 <strong>${newDate}</strong><br/>
      ⏰ <strong>${newTime}</strong>
    </p>

    <p>
      Dacă nu mai poți ajunge, poți anula programarea aici:<br/>
      ❌ <a href="${cancelUrl}">Anulează programarea</a>
    </p>

    <p>— Frizeo</p>
  `;
}

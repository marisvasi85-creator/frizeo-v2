type ClientConfirmationArgs = {
  clientName: string;
  date: string;
  time: string;
  cancelUrl: string;
  rescheduleUrl: string;
};

export function clientConfirmationTemplate({
  clientName,
  date,
  time,
  cancelUrl,
  rescheduleUrl,
}: ClientConfirmationArgs) {
  return `
    <h2>Salut ${clientName} 👋</h2>

    <p>Programarea ta a fost confirmată.</p>

    <p>
      📅 <strong>${date}</strong><br/>
      ⏰ <strong>${time}</strong>
    </p>

    <p>
      <a href="${rescheduleUrl}">🔁 Reprogramează</a><br/>
      <a href="${cancelUrl}">❌ Anulează</a>
    </p>

    <p>— Frizeo</p>
  `;
}

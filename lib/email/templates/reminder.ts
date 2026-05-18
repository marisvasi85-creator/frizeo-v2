export function reminderTemplate({
  clientName,
  date,
  time,
  cancelUrl,
  rescheduleUrl,
}: {
  clientName: string;
  date: string;
  time: string;
  cancelUrl: string;
  rescheduleUrl: string;
}) {
  return `
    <div style="font-family: Arial; max-width:500px; margin:auto;">
      
      <h2>Reminder programare</h2>

      <p>Salut ${clientName},</p>

      <p>
        Îți reamintim că ai o programare:
      </p>

      <div style="background:#f5f5f5; padding:10px; border-radius:8px;">
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Ora:</strong> ${time}</p>
      </div>

      <p>Dacă nu mai poți ajunge:</p>

      <a href="${rescheduleUrl}">Modifică</a> |
      <a href="${cancelUrl}">Anulează</a>

      <p style="font-size:12px; color:#999;">
        Frizeo
      </p>
    </div>
  `;
}
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

      <p>
        Programarea ta a fost confirmată cu succes.
      </p>

      <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:20px 0;">
        <p><strong>Frizer:</strong> ${barberName}</p>
        <p><strong>Serviciu:</strong> ${serviceName}</p>
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Ora:</strong> ${time}</p>
      </div>

      <p>
        Dacă ai nevoie să modifici sau să anulezi programarea:
      </p>

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

      <p>
  Dacă nu funcționează butoanele:
</p>

<p>
  Reprogramare: <br/>
  <a href="${rescheduleUrl}">${rescheduleUrl}</a>
</p>

<p>
  Anulare: <br/>
  <a href="${cancelUrl}">${cancelUrl}</a>
</p>

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
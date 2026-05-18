export function barberNewBookingTemplate({
  clientName,
  phone,
  serviceName,
  date,
  time,
}: {
  clientName: string;
  phone: string;
  serviceName: string;
  date: string;
  time: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px;">
      
      <h2 style="color:#111;">Programare nouă</h2>

      <p>Ai primit o programare nouă:</p>

      <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:20px 0;">
        <p><strong>Client:</strong> ${clientName}</p>
        <p><strong>Telefon:</strong> ${phone}</p>
        <p><strong>Serviciu:</strong> ${serviceName}</p>
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Ora:</strong> ${time}</p>
      </div>

      <p>
        Verifică dashboard-ul pentru detalii sau modificări.
      </p>

      <hr style="margin:30px 0;" />

      <p style="font-size:12px; color:#aaa;">
        Frizeo • Sistem programări
      </p>
    </div>
  `;
}
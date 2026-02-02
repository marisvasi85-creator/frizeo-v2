type CancelBookingArgs = {
  clientName: string;
  date: string;
  time: string;
};

export function cancelBookingTemplate({
  clientName,
  date,
  time,
}: CancelBookingArgs) {
  return `
    <h2>Salut ${clientName} 👋</h2>

    <p>Programarea ta a fost <strong>anulată cu succes</strong>.</p>

    <p>
      📅 <strong>${date}</strong><br/>
      ⏰ <strong>${time}</strong>
    </p>

    <p>Dacă dorești să faci o nouă programare, te așteptăm oricând.</p>

    <p>— Frizeo ✂️</p>
  `;
}

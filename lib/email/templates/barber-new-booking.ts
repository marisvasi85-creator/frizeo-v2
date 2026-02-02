// lib/email/templates/barber-new-booking.ts

type BarberNewBookingArgs = {
  barberName: string;
  clientName: string;
  clientPhone: string;
  date: string;
  time: string;
  serviceName?: string;
};

export function barberNewBookingTemplate({
  barberName,
  clientName,
  clientPhone,
  date,
  time,
  serviceName,
}: BarberNewBookingArgs) {
  return `
    <h2>Salut ${barberName} ✂️</h2>

    <p>Ai o <strong>nouă programare</strong>:</p>

    <p>
      👤 <strong>${clientName}</strong><br/>
      📞 ${clientPhone}
    </p>

    <p>
      📅 <strong>${date}</strong><br/>
      ⏰ <strong>${time}</strong>
    </p>

    ${
      serviceName
        ? `<p>🛎 Serviciu: <strong>${serviceName}</strong></p>`
        : ""
    }

    <p>— Frizeo</p>
  `;
}

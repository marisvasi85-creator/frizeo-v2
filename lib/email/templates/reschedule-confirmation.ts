// lib/email/templates/reschedule-confirmation.ts

type RescheduleConfirmationArgs = {
  barberName: string;
  date: string;
  time: string;
  cancelLink: string;
  rescheduleLink: string;
};

export function rescheduleConfirmationTemplate({
  barberName,
  date,
  time,
  cancelLink,
  rescheduleLink,
}: RescheduleConfirmationArgs) {
  return `
    <h2>Programare reprogramată ✂️</h2>

    <p>Salut 👋</p>

    <p>
      Programarea ta la <strong>${barberName}</strong> a fost
      <strong>reprogramată cu succes</strong>.
    </p>

    <p>
      📅 <strong>${date}</strong><br/>
      ⏰ <strong>${time}</strong>
    </p>

    <p>
      🔁 <a href="${rescheduleLink}">Reprogramează din nou</a><br/>
      ❌ <a href="${cancelLink}">Anulează programarea</a>
    </p>

    <p>— Frizeo</p>
  `;
}

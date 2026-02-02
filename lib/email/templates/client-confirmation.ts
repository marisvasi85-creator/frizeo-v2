// lib/email/templates/client-confirmation.ts

type ClientConfirmationArgs = {
  barberName: string;
  date: string;
  time: string;
  cancelLink: string;
  rescheduleLink: string;
};

export function clientConfirmationTemplate({
  barberName,
  date,
  time,
  cancelLink,
  rescheduleLink,
}: ClientConfirmationArgs) {
  return `
    <h2>Salut 👋</h2>

    <p>Programarea ta la <strong>${barberName}</strong> a fost confirmată.</p>

    <p>
      📅 <strong>${date}</strong><br/>
      ⏰ <strong>${time}</strong>
    </p>

    <p>
      <a href="${rescheduleLink}">🔁 Reprogramează</a><br/>
      <a href="${cancelLink}">❌ Anulează</a>
    </p>

    <p>— Frizeo ✂️</p>
  `;
}

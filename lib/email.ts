import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // 👈 IMPORTANT
  },
});


export async function sendBookingConfirmationEmail({
  to,
  name,
  date,
  time,
  cancelUrl,
}: {
  to: string;
  name: string;
  date: string;
  time: string;
  cancelUrl: string;
}) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Confirmare programare – Frizeo",
    html: `
      <h2>Salut ${name} 👋</h2>

      <p>Programarea ta a fost <strong>confirmată</strong>.</p>

      <ul>
        <li><strong>Data:</strong> ${date}</li>
        <li><strong>Ora:</strong> ${time}</li>
      </ul>

      <p>
        Dacă dorești să anulezi programarea:
        <br />
        <a href="${cancelUrl}">Anulează programarea</a>
      </p>

      <hr />
      <p style="font-size:12px;color:#666">
        Mesaj automat – Frizeo
      </p>
    `,
  });
}

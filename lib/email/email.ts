import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  tls: {
    rejectUnauthorized: false,
  },
});

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  /** ICS content so mail clients can offer “Add to calendar”. */
  icsContent?: string;
  icsFilename?: string;
};

export async function sendEmail({
  to,
  subject,
  html,
  icsContent,
  icsFilename = "programare-frizeo.ics",
}: SendEmailArgs) {
  if (!to) return;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    ...(icsContent
      ? {
          icalEvent: {
            method: "PUBLISH",
            filename: icsFilename,
            content: icsContent,
          },
        }
      : {}),
  });
}

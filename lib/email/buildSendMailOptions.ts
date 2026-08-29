export type SendMailIcsInput = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  icsContent?: string;
  icsFilename?: string;
};

/**
 * Build nodemailer options for transactional mail.
 *
 * Calendar invites must be a single MIME part. Nodemailer's `icalEvent`
 * always emits both a `text/calendar` alternative AND an `application/ics`
 * attachment of the same event, which Gmail/Apple import as two appointments.
 */
export function buildSendMailOptions({
  to,
  subject,
  html,
  from = process.env.EMAIL_FROM,
  icsContent,
  icsFilename = "programare-frizeo.ics",
}: SendMailIcsInput) {
  return {
    from,
    to,
    subject,
    html,
    ...(icsContent
      ? {
          attachments: [
            {
              filename: icsFilename,
              content: icsContent,
              contentType: "text/calendar; charset=utf-8; method=PUBLISH",
              contentDisposition: "attachment" as const,
            },
          ],
        }
      : {}),
  };
}

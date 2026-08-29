import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import MailComposer from "nodemailer/lib/mail-composer/index.js";

const Composer = MailComposer.default ?? MailComposer;

const SAMPLE_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "METHOD:PUBLISH",
  "BEGIN:VEVENT",
  "UID:booking-111@frizeo.ro",
  "DTSTART:20260901T070000Z",
  "DTEND:20260901T073000Z",
  "SUMMARY:Tuns",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

function buildSendMailOptions({ to, subject, html, from, icsContent, icsFilename = "programare-frizeo.ics" }) {
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
              contentDisposition: "attachment",
            },
          ],
        }
      : {}),
  };
}

function compileMime(mail) {
  return new Promise((resolve, reject) => {
    new Composer(mail).compile().build((err, msg) => {
      if (err) reject(err);
      else resolve(Buffer.isBuffer(msg) ? msg.toString("utf8") : String(msg));
    });
  });
}

function countCalendarMimeParts(mime) {
  const calendar = [...mime.matchAll(/Content-Type:\s*text\/calendar/gi)].length;
  const applicationIcs = [
    ...mime.matchAll(/Content-Type:\s*application\/ics/gi),
  ].length;
  return {
    calendar,
    applicationIcs,
    total: calendar + applicationIcs,
  };
}

test("lib buildSendMailOptions matches the single-attachment calendar payload", () => {
  const source = readFileSync(
    new URL("../lib/email/buildSendMailOptions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /attachments:/);
  assert.match(source, /text\/calendar; charset=utf-8; method=PUBLISH/);
  assert.match(source, /must be a single MIME part/);
});

test("nodemailer icalEvent emits two calendar MIME parts (the duplicate-booking bug)", async () => {
  const mime = await compileMime({
    from: "Frizeo <noreply@frizeo.ro>",
    to: "client@example.com",
    subject: "Programare confirmată",
    html: "<p>Salut</p>",
    icalEvent: {
      method: "PUBLISH",
      filename: "programare-frizeo.ics",
      content: SAMPLE_ICS,
    },
  });

  const parts = countCalendarMimeParts(mime);
  assert.equal(
    parts.total,
    2,
    `icalEvent should be the known dual-part source, got ${JSON.stringify(parts)}\n${mime}`,
  );
  assert.equal(parts.calendar, 1);
  assert.equal(parts.applicationIcs, 1);
});

test("booking confirmation mail attaches exactly one calendar part", async () => {
  const mail = buildSendMailOptions({
    from: "Frizeo <noreply@frizeo.ro>",
    to: "client@example.com",
    subject: "Programare confirmată",
    html: "<p>Salut</p>",
    icsContent: SAMPLE_ICS,
  });

  assert.equal(mail.icalEvent, undefined);
  assert.equal(mail.attachments?.length, 1);
  assert.match(mail.attachments[0].contentType, /text\/calendar/);
  assert.match(mail.attachments[0].content, /UID:booking-111@frizeo\.ro/);

  const mime = await compileMime(mail);
  const parts = countCalendarMimeParts(mime);
  assert.equal(
    parts.total,
    1,
    `expected a single calendar MIME part, got ${JSON.stringify(parts)}\n${mime}`,
  );
  assert.equal(parts.calendar, 1);
  assert.equal(parts.applicationIcs, 0);
});

test("email without ICS has no calendar MIME parts", async () => {
  const mime = await compileMime(
    buildSendMailOptions({
      from: "Frizeo <noreply@frizeo.ro>",
      to: "barber@example.com",
      subject: "Programare nouă",
      html: "<p>Client nou</p>",
    }),
  );

  assert.equal(countCalendarMimeParts(mime).total, 0);
});

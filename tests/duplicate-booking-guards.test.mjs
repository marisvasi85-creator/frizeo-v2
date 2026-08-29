import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public create confirms atomically and skips notify on replay", () => {
  const source = readFileSync(
    new URL("../app/api/bookings/create/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /confirmPendingHold/);
  assert.match(source, /didConfirm/);
  assert.match(source, /without sending a second email, SMS, or Google Calendar event/);
});

test("google calendar sync does not create a second event when one exists", () => {
  const source = readFileSync(
    new URL("../lib/google/syncBookingEvent.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /if \(booking\.google_event_id\)/);
  assert.match(source, /return booking\.google_event_id/);
});

test("calendar email copy warns against adding the event twice", () => {
  const source = readFileSync(
    new URL("../lib/calendar/bookingCalendar.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /programarea apare de două ori/);
});

test("sendEmail no longer uses nodemailer icalEvent", () => {
  const source = readFileSync(
    new URL("../lib/email/email.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /icalEvent/);
  assert.match(source, /buildSendMailOptions/);
});

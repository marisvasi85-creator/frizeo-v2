import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("outbox migration is additive, private, atomic, and lease-safe", () => {
  const sql = read(
    "supabase/migrations/20260917174543_booking_notification_outbox.sql",
  );

  assert.match(sql, /create table if not exists public\.booking_notification_outbox/i);
  assert.match(sql, /unique \(booking_id, channel\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /confirm_public_booking_with_outbox/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /status = 'confirmed'/i);
  assert.match(sql, /insert into public\.booking_notification_outbox/i);
  assert.match(sql, /on conflict \(booking_id, channel\) do nothing/i);
  assert.match(sql, /for update of job skip locked/i);
  assert.match(sql, /grant execute[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to (anon|authenticated)/i);
});

test("public create keeps legacy fallback and returns before delivery", () => {
  const route = read("app/api/bookings/create/route.ts");

  assert.match(route, /isBookingNotificationOutboxEnabled/);
  assert.match(route, /isMissingBookingNotificationOutboxSchema/);
  assert.match(route, /confirmPendingHoldWithOutbox/);
  assert.match(route, /notificationOutboxActive = false/);
  assert.match(route, /after\(async \(\) =>/);

  const outboxReturn = route.indexOf("if (notificationOutboxActive)");
  const googleSync = route.indexOf("await syncBookingToGoogleCalendar");
  assert.ok(outboxReturn > -1 && googleSync > outboxReturn);
  assert.match(
    route.slice(outboxReturn, googleSync),
    /return NextResponse\.json\(/,
  );
});

test("worker has per-channel retry, cancellation guard, and claim-token writes", () => {
  const worker = read("lib/bookings/notificationOutboxWorker.ts");

  assert.match(worker, /claim_booking_notification_jobs/);
  assert.match(worker, /booking\.status !== "confirmed"/);
  assert.match(worker, /job\.channel === "google_calendar"/);
  assert.match(worker, /job\.channel === "client_sms"/);
  assert.match(worker, /job\.channel === "barber_email"/);
  assert.match(worker, /sendEmail/);
  assert.match(worker, /\.eq\("claim_token", job\.claim_token\)/);
  assert.match(worker, /status: terminal \? "failed" : "pending"/);
});

test("confirmed page does not claim the queued email was already sent", () => {
  const page = read(
    "app/booking/confirmed/[bookingId]/BookingConfirmedClient.tsx",
  );
  assert.match(page, /Vei primi un email de confirmare în câteva momente/);
  assert.doesNotMatch(page, /Am trimis un email de confirmare/);
});

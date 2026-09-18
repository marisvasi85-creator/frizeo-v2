import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("public confirm uses one request and still goes through reservePendingHold", () => {
  const client = read("app/booking/[barberId]/components/BookingClient.tsx");
  const create = read("app/api/bookings/create/route.ts");
  const dashboard = read("app/admin/bookings/new/AddBookingClient.tsx");

  assert.match(client, /\/api\/bookings\/create/);
  assert.doesNotMatch(client, /\/api\/bookings\/hold/);
  assert.match(client, /barber_service_id: serviceId/);
  assert.match(client, /start_time: selectedSlot/);

  assert.match(dashboard, /\/api\/bookings\/create/);
  assert.doesNotMatch(dashboard, /\/api\/bookings\/hold/);
  assert.match(dashboard, /booking_context: "dashboard"/);

  assert.match(create, /isOneShot/);
  assert.match(create, /reservePendingHold/);
  assert.match(create, /slotAlreadyReserved/);
  assert.match(create, /bucket: "booking-hold"/);
});

test("one-shot reserve keeps overlap, Google busy, access, lead time, and plan limit", () => {
  const reserve = read("lib/bookings/reservePendingHold.ts");

  assert.match(reserve, /checkBarberBookingAccess/);
  assert.match(reserve, /assertBookingLeadTimeForBarber/);
  assert.match(reserve, /checkBookingLimit/);
  assert.match(reserve, /getGoogleBusyIntervalsForDate/);
  assert.match(reserve, /slotOverlapsBusyIntervals/);
  assert.match(reserve, /prevent|getActiveBookings/);
  assert.match(reserve, /timesOverlap/);
  assert.match(reserve, /Nu poți programa peste pauză/);
  assert.match(reserve, /status: "pending"/);
  assert.match(reserve, /Promise\.all\(/);
});

test("hold endpoint remains as a compatibility wrapper over reservePendingHold", () => {
  const hold = read("app/api/bookings/hold/route.ts");
  assert.match(hold, /reservePendingHold/);
  assert.match(hold, /enforceRateLimit/);
  assert.match(hold, /holdId: reserved.hold.id/);
});

test("two-step create-by-bookingId still confirms only after its own validations", () => {
  const create = read("app/api/bookings/create/route.ts");
  assert.match(create, /if \(!slotAlreadyReserved\)/);
  assert.match(create, /confirmPendingHold/);
  assert.match(create, /didConfirm/);
});

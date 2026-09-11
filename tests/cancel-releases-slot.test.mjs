import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { reclaimExpiredHolds } from "../lib/bookings/reclaimExpiredHolds.ts";
import {
  googleEventAlreadyGone,
  googleEventReleased,
  deleteGoogleEvent,
  releaseGoogleCalendarEvent,
} from "../lib/google/deleteEvent.ts";
import { busyIntervalsFromFreeBusyResponse } from "../lib/google/queryFreeBusy.ts";
import { getActiveBookings } from "../lib/schedule/bookings.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("cancelled and expired pending bookings do not occupy generated slots", () => {
  const now = new Date("2026-09-11T08:00:00.000Z");
  const active = getActiveBookings(
    [
      {
        start_time: "10:00",
        end_time: "10:30",
        status: "cancelled",
        expires_at: null,
      },
      {
        start_time: "11:00",
        end_time: "11:30",
        status: "pending",
        expires_at: "2026-09-11T07:00:00.000Z",
      },
      {
        start_time: "12:00",
        end_time: "12:30",
        status: "confirmed",
        expires_at: "2026-09-11T07:00:00.000Z",
      },
    ],
    now,
  );

  assert.deepEqual(
    active.map((row) => row.start_time),
    ["12:00"],
  );
});

test("Google delete treats 404/410 as released so a missing event cannot keep the slot", () => {
  assert.equal(googleEventAlreadyGone(404), true);
  assert.equal(googleEventAlreadyGone(410), true);
  assert.equal(googleEventReleased(204), true);
  assert.equal(googleEventReleased(404), true);
  assert.equal(googleEventReleased(403), false);
});

test("deleteGoogleEvent returns true when Google says the event is already gone", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    /** @type {Response} */ ({ ok: false, status: 404 });

  try {
    assert.equal(
      await deleteGoogleEvent({
        accessToken: "token",
        calendarId: "primary",
        eventId: "evt-1",
      }),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("releaseGoogleCalendarEvent patches leftover events to transparent when delete is denied", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method, body: init?.body });
    if (init?.method === "DELETE") {
      return /** @type {Response} */ ({ ok: false, status: 403 });
    }
    return /** @type {Response} */ ({ ok: true, status: 200 });
  };

  try {
    assert.equal(
      await releaseGoogleCalendarEvent({
        accessToken: "token",
        calendarId: "primary",
        eventId: "evt-1",
      }),
      true,
    );
    assert.equal(calls[0]?.method, "DELETE");
    assert.equal(calls[1]?.method, "PATCH");
    assert.match(String(calls[1]?.body), /transparent/);
    assert.match(String(calls[1]?.body), /cancelled/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("FreeBusy reads busy blocks when Google keys the calendar by email instead of primary", () => {
  assert.deepEqual(
    busyIntervalsFromFreeBusyResponse(
      {
        calendars: {
          "barber@gmail.com": {
            busy: [
              {
                start: "2026-09-11T07:00:00Z",
                end: "2026-09-11T07:30:00Z",
              },
            ],
          },
        },
      },
      "primary",
    ),
    [
      {
        start: "2026-09-11T07:00:00Z",
        end: "2026-09-11T07:30:00Z",
      },
    ],
  );
});

test("reclaimExpiredHolds cancels pending rows whose hold TTL has passed", async () => {
  const calls = [];
  const supabase = {
    from(table) {
      calls.push(table);
      return {
        update(values) {
          calls.push(values);
          return {
            eq(column, value) {
              calls.push([column, value]);
              return this;
            },
            lt(column, value) {
              calls.push([column, value]);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  await reclaimExpiredHolds(supabase, {
    barberId: "barber-1",
    date: "2026-09-20",
    now: new Date("2026-09-11T08:00:00.000Z"),
  });

  assert.deepEqual(calls[0], "bookings");
  assert.deepEqual(calls[1], { status: "cancelled" });
  assert.deepEqual(calls[2], ["barber_id", "barber-1"]);
  assert.deepEqual(calls[3], ["date", "2026-09-20"]);
  assert.deepEqual(calls[4], ["status", "pending"]);
  assert.deepEqual(calls[5], ["expires_at", "2026-09-11T08:00:00.000Z"]);
});

test("cancel API releases the Google event and clears google_event_id when delete succeeds", () => {
  const source = readRepo("app/api/bookings/cancel/route.ts");
  assert.match(source, /releaseGoogleEventForBarber/);
  assert.match(source, /google_event_id: googleReleased \? null/);
  assert.match(source, /status: "cancelled"/);
});

test("assistant cancel also releases the Google event before marking cancelled", () => {
  const source = readRepo("lib/assistant/tools/cancelBooking.ts");
  assert.match(source, /deleteBookingGoogleEvent/);
  assert.match(source, /google_event_id: googleReleased \? null/);
});

test("public slot generation drops leftover cancelled Google events before FreeBusy", () => {
  const source = readRepo("lib/google/getGoogleBusyIntervals.ts");
  assert.match(source, /releaseLeftoverCancelledGoogleEvents/);
});

test("hold and assistant create reclaim expired pending holds so the unique slot is free", () => {
  const hold = readRepo("app/api/bookings/hold/route.ts");
  const assistant = readRepo("lib/assistant/tools/createBooking.ts");
  assert.match(hold, /reclaimExpiredHolds/);
  assert.match(assistant, /reclaimExpiredHolds/);
});

test("overlap trigger cancels expired holds and unique index ignores cancelled rows", () => {
  const sql = readRepo(
    "supabase/migrations/20260911120000_release_cancelled_booking_slots.sql",
  );
  assert.match(sql, /SET status = 'cancelled'/);
  assert.match(sql, /expires_at <= now\(\)/);
  assert.match(
    sql,
    /WHERE status IN \('confirmed', 'pending'\)/,
  );
  assert.match(sql, /DROP INDEX IF EXISTS public\.bookings_unique_slot/);
});

test("public slot generator still filters occupancy through getActiveBookings", () => {
  const source = readRepo("lib/schedule/generatePublicFreeSlots.ts");
  assert.match(source, /getActiveBookings\(bookings, now\)/);
});

test("orphan Google events are deleted if the event id cannot be saved", () => {
  const source = readRepo("lib/google/syncBookingEvent.ts");
  assert.match(source, /failed to save event id/);
  assert.match(source, /deleteGoogleEvent/);
});

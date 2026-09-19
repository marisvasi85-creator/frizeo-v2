import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  busyRangeToInterval,
  calendarEventBlocksBooking,
  calendarEventsToBusyIntervals,
} from "../lib/google/calendarBusy.ts";
import { getGoogleBusyIntervalsForDate } from "../lib/google/getGoogleBusyIntervals.ts";
import { busyIntervalsFromFreeBusyResponse } from "../lib/google/queryFreeBusy.ts";
import { generatePublicFreeSlots } from "../lib/schedule/generatePublicFreeSlots.ts";
import { subtractBusyIntervals } from "../lib/schedule/subtractBusyIntervals.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const DATE = "2026-09-19";
// 10:00-11:00 Europe/Bucharest in late September is UTC+3.
const PERSONAL_START = "2026-09-19T07:00:00Z";
const PERSONAL_END = "2026-09-19T08:00:00Z";

function personalEvent(overrides = {}) {
  return {
    id: "personal-1",
    status: "confirmed",
    transparency: "opaque",
    start: { dateTime: PERSONAL_START },
    end: { dateTime: PERSONAL_END },
    ...overrides,
  };
}

test("UTC Google busy converts to Bucharest wall time", () => {
  assert.deepEqual(busyRangeToInterval(PERSONAL_START, PERSONAL_END, DATE), {
    start: "10:00",
    end: "11:00",
  });
});

test("all-day personal events occupy the whole booking day", () => {
  assert.deepEqual(
    calendarEventsToBusyIntervals(
      [
        {
          id: "vacation",
          status: "confirmed",
          start: { date: DATE },
          end: { date: "2026-09-20" },
        },
      ],
      DATE,
    ),
    [{ start: "00:00", end: "23:59" }],
  );
});

test("transparent personal events still block public booking", () => {
  assert.equal(
    calendarEventBlocksBooking(
      personalEvent({ transparency: "transparent" }),
      new Set(),
    ),
    true,
  );
  assert.deepEqual(
    calendarEventsToBusyIntervals(
      [personalEvent({ transparency: "transparent" })],
      DATE,
    ),
    [{ start: "10:00", end: "11:00" }],
  );
});

test("working locations and declined invites do not block", () => {
  assert.equal(
    calendarEventBlocksBooking(
      personalEvent({ eventType: "workingLocation" }),
      new Set(),
    ),
    false,
  );
  assert.equal(
    calendarEventBlocksBooking(
      personalEvent({
        attendees: [{ self: true, responseStatus: "declined" }],
      }),
      new Set(),
    ),
    false,
  );
});

test("leftover Frizeo events are skipped by id, not by punching the hour", () => {
  const personal = personalEvent();
  const leftover = personalEvent({
    id: "frizeo-cancelled",
    transparency: "opaque",
  });

  assert.deepEqual(
    calendarEventsToBusyIntervals(
      [personal, leftover],
      DATE,
      new Set(["frizeo-cancelled"]),
    ),
    [{ start: "10:00", end: "11:00" }],
  );
});

test("subtracting cancelled booking times would hide a personal event on the same hour", () => {
  assert.deepEqual(
    subtractBusyIntervals(
      [{ start: "10:00", end: "11:00" }],
      [{ start: "10:00", end: "10:30" }],
    ),
    [{ start: "10:30", end: "11:00" }],
  );
  assert.deepEqual(
    subtractBusyIntervals(
      [{ start: "10:00", end: "11:00" }],
      [{ start: "10:00", end: "11:00" }],
    ),
    [],
  );
});

test("FreeBusy merges a populated email calendar when primary is empty", () => {
  assert.deepEqual(
    busyIntervalsFromFreeBusyResponse(
      {
        calendars: {
          primary: { busy: [] },
          "barber@gmail.com": {
            busy: [
              {
                start: PERSONAL_START,
                end: PERSONAL_END,
              },
            ],
          },
        },
      },
      "primary",
    ),
    [
      {
        start: PERSONAL_START,
        end: PERSONAL_END,
      },
    ],
  );
});

function googleAccount() {
  return {
    access_token: "token",
    refresh_token: "refresh",
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    calendar_id: "primary",
  };
}

function supabaseMock(releasedRows) {
  return {
    from(table) {
      if (table === "barber_google_accounts") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: googleAccount(),
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "bookings") {
        const result = { data: releasedRows, error: null };
        const chain = {
          select() {
            return chain;
          },
          eq() {
            return chain;
          },
          in() {
            return chain;
          },
          gte() {
            return chain;
          },
          lte() {
            return Promise.resolve(result);
          },
        };
        return chain;
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

test("public busy keeps a personal event that overlaps a cancelled Frizeo booking", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    const href = String(url);
    if (href.includes("calendarList")) {
      return {
        ok: true,
        json: async () => ({
          items: [{ id: "primary", primary: true, selected: true }],
        }),
      };
    }
    if (href.includes("/events")) {
      return {
        ok: true,
        json: async () => ({
          items: [
            personalEvent({ transparency: "transparent" }),
            personalEvent({ id: "frizeo-cancelled" }),
          ],
        }),
      };
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  try {
    const busy = await getGoogleBusyIntervalsForDate(
      supabaseMock([
        {
          date: DATE,
          start_time: "10:00:00",
          end_time: "11:00:00",
          google_event_id: "frizeo-cancelled",
        },
      ]),
      "barber-1",
      DATE,
    );

    assert.deepEqual(busy, [{ start: "10:00", end: "11:00" }]);
    assert.equal(
      urls.some((url) => url.includes("/events")),
      true,
    );
    assert.equal(
      urls.some((url) => url.includes("freeBusy")),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Frizeo writes Google events as opaque busy blocks", () => {
  const source = readRepo("lib/google/createEvent.ts");
  assert.match(source, /transparency: "opaque"/);
});

test("public Google busy uses events.list and skips leftover Frizeo ids without deleting first", () => {
  const source = readRepo("lib/google/getGoogleBusyIntervals.ts");
  assert.doesNotMatch(source, /releaseLeftoverCancelledGoogleEvents/);
  assert.match(source, /listBusyCalendarEvents/);
  assert.match(source, /google_event_id/);
  assert.match(source, /calendarEventsToBusyIntervals/);
  assert.match(source, /GOOGLE BUSY INTERVALS ERROR/);
  assert.match(source, /RELEASED_BOOKING_STATUSES/);
});

test("public slots hide the hour covered by a personal Google event", () => {
  const slots = generatePublicFreeSlots({
    date: DATE,
    resolved: {
      isWorking: true,
      workStart: "09:00",
      workEnd: "12:00",
      breakEnabled: false,
      breakStart: null,
      breakEnd: null,
      slotDuration: 60,
    },
    duration: 60,
    bookings: [],
    googleBusyIntervals: [{ start: "10:00", end: "11:00" }],
    minNoticeHours: 0,
    now: new Date("2026-09-18T08:00:00.000Z"),
  });

  assert.deepEqual(slots, ["09:00", "11:00"]);
});

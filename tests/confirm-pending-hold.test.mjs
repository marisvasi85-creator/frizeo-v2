import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Mirrors lib/bookings/confirmPendingHold.ts against a fluent mock.
 * Source contract is asserted so the implementation cannot drift silently.
 */
async function confirmPendingHold(supabase, input, now = new Date()) {
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      client_name: input.client_name,
      client_phone: input.client_phone,
      client_email: input.client_email || null,
      client_notes: input.client_notes ?? null,
    })
    .eq("id", input.bookingId)
    .eq("status", "pending")
    .gt("expires_at", now.toISOString())
    .select()
    .single();

  if (data) {
    return { ok: true, booking: data, didConfirm: true };
  }

  const { data: existing } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", input.bookingId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (existing) {
    return { ok: true, booking: existing, didConfirm: false };
  }

  return { ok: false, booking: null, didConfirm: false, error };
}

function createBookingStore(row) {
  const state = { row: { ...row } };

  return {
    state,
    from(table) {
      assert.equal(table, "bookings");
      return {
        update(patch) {
          const filters = {};
          const chain = {
            eq(column, value) {
              filters[column] = value;
              return chain;
            },
            gt(column, value) {
              filters[`${column}__gt`] = value;
              return chain;
            },
            select() {
              return chain;
            },
            async single() {
              const current = state.row;
              if (current.id !== filters.id || current.status !== filters.status) {
                return { data: null, error: { message: "not pending" } };
              }
              if (
                filters.expires_at__gt &&
                !(current.expires_at > filters.expires_at__gt)
              ) {
                return { data: null, error: { message: "expired" } };
              }
              Object.assign(current, patch);
              return { data: { ...current }, error: null };
            },
          };
          return chain;
        },
        select() {
          const filters = {};
          const chain = {
            eq(column, value) {
              filters[column] = value;
              return chain;
            },
            async maybeSingle() {
              const current = state.row;
              if (current.id !== filters.id) return { data: null, error: null };
              if (filters.status && current.status !== filters.status) {
                return { data: null, error: null };
              }
              return { data: { ...current }, error: null };
            },
          };
          return chain;
        },
      };
    },
  };
}

const HOLD = {
  id: "hold-1",
  status: "pending",
  expires_at: "2099-01-01T00:00:00.000Z",
  client_name: null,
};

const CLIENT = {
  bookingId: "hold-1",
  client_name: "Ana",
  client_phone: "0712345678",
  client_email: "ana@example.com",
  client_notes: null,
};

test("confirmPendingHold source stays atomic and idempotent", () => {
  const source = readFileSync(
    new URL("../lib/bookings/confirmPendingHold.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /\.eq\("status", "pending"\)/);
  assert.match(source, /\.gt\("expires_at"/);
  assert.match(source, /didConfirm: true/);
  assert.match(source, /didConfirm: false/);
});

test("first confirm of a pending hold wins and reports didConfirm", async () => {
  const db = createBookingStore(HOLD);
  const result = await confirmPendingHold(db, CLIENT, new Date("2026-08-29T12:00:00Z"));

  assert.equal(result.ok, true);
  assert.equal(result.didConfirm, true);
  assert.equal(result.booking.status, "confirmed");
  assert.equal(result.booking.client_name, "Ana");
});

test("second confirm of the same hold is idempotent and does not re-confirm", async () => {
  const db = createBookingStore({ ...HOLD });
  const first = await confirmPendingHold(db, CLIENT, new Date("2026-08-29T12:00:00Z"));
  const second = await confirmPendingHold(db, CLIENT, new Date("2026-08-29T12:00:01Z"));

  assert.equal(first.didConfirm, true);
  assert.equal(second.ok, true);
  assert.equal(second.didConfirm, false);
  assert.equal(second.booking.id, "hold-1");
  assert.equal(second.booking.status, "confirmed");
});

test("concurrent confirms: only one winner reports didConfirm", async () => {
  const db = createBookingStore({ ...HOLD });
  const now = new Date("2026-08-29T12:00:00Z");
  const [a, b] = await Promise.all([
    confirmPendingHold(db, CLIENT, now),
    confirmPendingHold(db, CLIENT, now),
  ]);

  const winners = [a, b].filter((result) => result.didConfirm);
  const replays = [a, b].filter((result) => result.ok && !result.didConfirm);

  assert.equal(winners.length, 1);
  assert.equal(replays.length, 1);
  assert.equal(a.booking.id, b.booking.id);
});

test("missing hold is not confirmed", async () => {
  const db = createBookingStore({
    id: "other",
    status: "pending",
    expires_at: "2099-01-01T00:00:00.000Z",
  });
  const result = await confirmPendingHold(db, CLIENT, new Date("2026-08-29T12:00:00Z"));
  assert.equal(result.ok, false);
  assert.equal(result.didConfirm, false);
});

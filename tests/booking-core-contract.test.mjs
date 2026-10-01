import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

/** Matches `bookings.status` default in the baseline schema. */
const BOOKINGS_STATUS_DB_DEFAULT = "confirmed";

function applyBookingsRowDefaults(payload) {
  return {
    status: BOOKINGS_STATUS_DB_DEFAULT,
    ...payload,
  };
}

function createCanFindHold(row, now = new Date()) {
  return (
    row.status === "pending" &&
    typeof row.expires_at === "string" &&
    row.expires_at > now.toISOString()
  );
}

function holdInsertBlock(source) {
  const match = source.match(/\.insert\(\{([\s\S]*?)\}\)\s*\n\s*\.select\(\)/);
  assert.ok(match, "hold route must insert a bookings row");
  return match[1];
}

test("schema default for bookings.status is confirmed, not pending", () => {
  const schema = readRepo("supabase/migrations/20260620_baseline_schema.sql");
  assert.match(
    schema,
    /"status" text default 'confirmed'::text not null/,
  );
});

test("hold insert block sets pending and does not rely on the DB default", () => {
  const block = holdInsertBlock(readRepo("app/api/bookings/hold/route.ts"));
  assert.match(block, /status:\s*"pending"/);
  assert.match(block, /created_via:/);
  assert.match(block, /expires_at:/);
  assert.doesNotMatch(block, /status:\s*"confirmed"/);
});

test("create only loads an unexpired pending hold", () => {
  const source = readRepo("app/api/bookings/create/route.ts");
  assert.match(source, /\.eq\("status", "pending"\)/);
  assert.match(source, /\.gt\("expires_at"/);
  assert.match(source, /Slot indisponibil sau expirat/);
  assert.match(source, /confirmPendingHold/);
});

test("public and admin booking clients still go hold then create", () => {
  const publicClient = readRepo(
    "app/booking/[barberId]/components/BookingClient.tsx",
  );
  const adminClient = readRepo("app/admin/bookings/new/AddBookingClient.tsx");
  for (const source of [publicClient, adminClient]) {
    assert.match(source, /\/api\/bookings\/hold/);
    assert.match(source, /\/api\/bookings\/create/);
    assert.match(source, /holdId/);
  }
});

test("a hold that only tags created_via is invisible to create (Sept 9 outage)", () => {
  const expiresAt = "2099-01-01T00:00:00.000Z";
  const broken = applyBookingsRowDefaults({
    created_via: "public",
    expires_at: expiresAt,
  });
  assert.equal(broken.status, "confirmed");
  assert.equal(createCanFindHold(broken), false);

  const correct = applyBookingsRowDefaults({
    status: "pending",
    created_via: "public",
    expires_at: expiresAt,
  });
  assert.equal(correct.status, "pending");
  assert.equal(createCanFindHold(correct), true);
});

test("email lifecycle module stays out of the booking write path", () => {
  const core = [
    "app/api/bookings/hold/route.ts",
    "app/api/bookings/create/route.ts",
    "app/api/bookings/cancel/route.ts",
    "lib/bookings/confirmPendingHold.ts",
    "app/booking/[barberId]/components/BookingClient.tsx",
  ];
  for (const relativePath of core) {
    const source = readRepo(relativePath);
    assert.doesNotMatch(
      source,
      /frizeo-email\/lifecycle/,
      `${relativePath} must not import lifecycle`,
    );
  }
});

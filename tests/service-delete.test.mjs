import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CATALOG_SERVICE_DELETED_MESSAGE,
  canUseServiceForExistingBooking,
  catalogDeletePatch,
  isBookableCatalogService,
  isDeletedFromCatalog,
} from "../lib/services/catalog.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("deleted catalog rows are not bookable for new appointments", () => {
  assert.equal(isDeletedFromCatalog({ deleted_at: null, active: true }), false);
  assert.equal(
    isDeletedFromCatalog({ deleted_at: "2026-09-15T12:00:00.000Z", active: false }),
    true,
  );
  assert.equal(isBookableCatalogService({ active: true, deleted_at: null }), true);
  assert.equal(isBookableCatalogService({ active: false, deleted_at: null }), false);
  assert.equal(
    isBookableCatalogService({
      active: false,
      deleted_at: "2026-09-15T12:00:00.000Z",
    }),
    false,
  );
});

test("existing bookings may keep a deleted service; switching cannot", () => {
  const deleted = {
    active: false,
    deleted_at: "2026-09-15T12:00:00.000Z",
  };
  const live = { active: true, deleted_at: null };

  assert.equal(
    canUseServiceForExistingBooking({
      service: deleted,
      requestedServiceId: "svc-1",
      originalServiceId: "svc-1",
    }),
    true,
  );
  assert.equal(
    canUseServiceForExistingBooking({
      service: deleted,
      requestedServiceId: "svc-2",
      originalServiceId: "svc-1",
    }),
    false,
  );
  assert.equal(
    canUseServiceForExistingBooking({
      service: live,
      requestedServiceId: "svc-2",
      originalServiceId: "svc-1",
    }),
    true,
  );
});

test("catalog delete patch deactivates and stamps deleted_at", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");
  assert.deepEqual(catalogDeletePatch(now), {
    deleted_at: "2026-09-15T12:00:00.000Z",
    active: false,
  });
  assert.match(CATALOG_SERVICE_DELETED_MESSAGE, /Programările existente rămân/);
});

test("delete API soft-deletes instead of hard-deleting barber_services", () => {
  const source = readRepo("app/api/services/delete/route.ts");
  assert.match(source, /catalogDeletePatch/);
  assert.match(source, /\.update\(catalogDeletePatch\(\)\)/);
  assert.doesNotMatch(source, /\.delete\(\)/);
  assert.doesNotMatch(source, /23503/);
});

test("catalog listings hide deleted services while bookings can still join them", () => {
  const adminPage = readRepo("app/admin/services/page.tsx");
  const publicList = readRepo("app/api/services/route.ts");
  const bookingsList = readRepo("lib/bookings/listBookingsForAdmin.ts");

  assert.match(adminPage, /\.is\("deleted_at", null\)/);
  assert.match(publicList, /\.is\("deleted_at", null\)/);
  assert.doesNotMatch(bookingsList, /\.is\("deleted_at", null\)/);
});

test("migration keeps booking FKs and allows reschedule of the original service", () => {
  const sql = readRepo(
    "supabase/migrations/20260915140000_barber_service_delete_keeps_bookings.sql",
  );
  assert.match(sql, /ADD COLUMN IF NOT EXISTS deleted_at timestamptz/);
  assert.match(sql, /ON DELETE SET NULL/);
  assert.match(sql, /AND s\.deleted_at IS NULL/);
  assert.match(
    sql,
    /s\.id IS NOT DISTINCT FROM old_booking\.barber_service_id/,
  );
});

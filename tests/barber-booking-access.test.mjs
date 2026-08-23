import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidRomanianPhone,
  normalizeRomanianPhone,
} from "../lib/phone/normalizeRomanianPhone.ts";
import {
  asBookingAccessMode,
  BOOKING_ACCESS_LABELS,
  BOOKING_ACCESS_MODES,
  canBookForAccess,
  publicAccessMessage,
} from "../lib/barber-access/types.ts";

test("Romanian phone formats resolve to one canonical client identifier", () => {
  const expected = "40745123456";

  assert.equal(normalizeRomanianPhone("0745 123 456"), expected);
  assert.equal(normalizeRomanianPhone("+40 745 123 456"), expected);
  assert.equal(normalizeRomanianPhone("0040 745 123 456"), expected);
  assert.equal(normalizeRomanianPhone("745123456"), expected);
});

test("invalid or incomplete phone values are rejected", () => {
  assert.equal(normalizeRomanianPhone(""), null);
  assert.equal(normalizeRomanianPhone("0745"), null);
  assert.equal(normalizeRomanianPhone("not-a-phone"), null);
  assert.equal(isValidRomanianPhone("0745123456"), true);
  assert.equal(isValidRomanianPhone("123"), false);
});

test("all three public modes exist and unknown values remain safely open", () => {
  assert.deepEqual(BOOKING_ACCESS_MODES, [
    "open",
    "approval_required",
    "approved_only",
  ]);
  assert.equal(asBookingAccessMode("approval_required"), "approval_required");
  assert.equal(asBookingAccessMode("approved_only"), "approved_only");
  assert.equal(asBookingAccessMode("unexpected"), "open");
  assert.equal(BOOKING_ACCESS_LABELS.open, "Programări deschise");
});

test("public access rules cover open, approval-required and approved-only", () => {
  assert.equal(canBookForAccess("open", "not_found"), true);
  assert.equal(canBookForAccess("approval_required", "approved"), true);
  assert.equal(canBookForAccess("approval_required", "pending"), false);
  assert.equal(canBookForAccess("approval_required", "rejected"), false);
  assert.equal(canBookForAccess("approval_required", "blocked"), false);
  assert.equal(canBookForAccess("approved_only", "approved"), true);
  assert.equal(canBookForAccess("approved_only", "not_found"), false);

  assert.equal(
    publicAccessMessage({
      accessMode: "approved_only",
      status: "not_found",
      canBook: false,
    }),
    "Acest profesionist nu acceptă momentan clienți noi. Programările sunt disponibile doar pentru clienții deja acceptați.",
  );
});

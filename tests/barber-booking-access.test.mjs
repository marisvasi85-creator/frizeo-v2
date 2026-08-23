import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  canSubmitAccessRequest,
  publicAccessMessage,
} from "../lib/barber-access/types.ts";
import { isExistingClient } from "../lib/barber-access/clientList.ts";

function projectFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

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
  assert.equal(canBookForAccess("open", "blocked"), false);
  assert.equal(canBookForAccess("approval_required", "approved"), true);
  assert.equal(canBookForAccess("approval_required", "pending"), false);
  assert.equal(canBookForAccess("approval_required", "rejected"), false);
  assert.equal(canBookForAccess("approval_required", "blocked"), false);
  assert.equal(canBookForAccess("approved_only", "approved"), true);
  assert.equal(canBookForAccess("approved_only", "not_found"), false);
  assert.equal(canBookForAccess("approved_only", "blocked"), false);

  assert.equal(canSubmitAccessRequest("approval_required", null), true);
  assert.equal(
    canSubmitAccessRequest("approval_required", "not_found"),
    true,
  );
  assert.equal(canSubmitAccessRequest("approval_required", "blocked"), false);
  assert.equal(canSubmitAccessRequest("approval_required", "pending"), false);
  assert.equal(canSubmitAccessRequest("approval_required", "rejected"), false);
  assert.equal(canSubmitAccessRequest("approved_only", "not_found"), false);

  assert.equal(
    publicAccessMessage({
      accessMode: "open",
      status: "blocked",
      canBook: false,
    }),
    "Momentan nu poți realiza o programare online la acest profesionist.",
  );

  assert.equal(
    publicAccessMessage({
      accessMode: "approved_only",
      status: "not_found",
      canBook: false,
    }),
    "Acest profesionist nu acceptă momentan clienți noi. Programările sunt disponibile doar pentru clienții deja acceptați.",
  );
});

test("direct booking keeps the existing phone field and enforces access server-side", () => {
  const bookingClient = projectFile(
    "app/booking/[barberId]/components/BookingClient.tsx",
  );
  const holdRoute = projectFile("app/api/bookings/hold/route.ts");
  const createRoute = projectFile("app/api/bookings/create/route.ts");

  assert.equal(bookingClient.includes("BookingAccessPrompt"), false);
  assert.equal(
    bookingClient.match(/placeholder="Telefon \(07xxxxxxxx\)"/g)?.length,
    1,
  );

  for (const route of [holdRoute, createRoute]) {
    assert.equal(route.includes("checkBarberBookingAccess"), true);
    assert.equal(route.includes("requireManagedBarber"), true);
    assert.equal(route.includes('booking_context === "dashboard"'), true);
  }
});

test("the public salon cards expose the required mode-specific actions", () => {
  const card = projectFile("app/booking/_components/PublicBarberCard.tsx");
  const prompt = projectFile("app/booking/_components/BookingAccessPrompt.tsx");

  for (const label of [
    "Disponibil",
    "Acces pe bază de aprobare",
    "Închis pentru clienți noi",
  ]) {
    assert.equal(card.includes(label), true);
  }

  for (const action of ["Alege", "Înscrie-te", "Sunt deja client"]) {
    assert.equal(`${card}\n${prompt}`.includes(action), true);
  }
});

test("bulk approval re-checks blocked rows at write time", () => {
  const actionsRoute = projectFile(
    "app/api/barber-access/clients/actions/route.ts",
  );

  assert.equal(actionsRoute.includes("ignoreDuplicates: true"), true);
  assert.equal(actionsRoute.includes('.neq("status", "blocked")'), true);
  assert.equal(actionsRoute.includes('row.status === "blocked"'), true);
});

test("accepted clients appear among existing clients before their first booking", () => {
  assert.equal(
    isExistingClient({ appointmentCount: 0, accessStatus: "approved" }),
    true,
  );
  assert.equal(
    isExistingClient({ appointmentCount: 1, accessStatus: null }),
    true,
  );

  for (const accessStatus of [null, "pending", "rejected", "blocked"]) {
    assert.equal(
      isExistingClient({ appointmentCount: 0, accessStatus }),
      false,
    );
  }
});

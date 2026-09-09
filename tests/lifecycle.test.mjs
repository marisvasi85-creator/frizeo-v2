import assert from "node:assert/strict";
import test from "node:test";
import {
  automationPriorityForKey,
  computeLifecycleSnapshot,
  evaluateLifecycleFrequencyCap,
  LIFECYCLE_PRIORITY,
  pickHighestPriorityAutomation,
  shouldSuppressHistoricalCatchup,
} from "../lib/frizeo-email/lifecycle.ts";

function facts(overrides = {}) {
  return {
    onboardingComplete: true,
    recordedBookings: 0,
    completedBookings: 0,
    onlineBookings: 0,
    manualBookings: 0,
    bookingsLast7d: 0,
    bookingsLast30d: 0,
    monthlyBookings: 0,
    hadMeaningfulActivity: false,
    googleCalendarConnected: false,
    activeBarberCount: 1,
    hasBarberSeatsAvailable: false,
    isPaid: false,
    isTrialing: true,
    trialEndsInDays: 20,
    trialExpired: false,
    daysSinceLastActivity: 0,
    daysSinceLastBooking: null,
    ...overrides,
  };
}

test("signup_incomplete when onboarding is not done", () => {
  const snap = computeLifecycleSnapshot(
    facts({ onboardingComplete: false, recordedBookings: 0 }),
  );
  assert.equal(snap.stage, "signup_incomplete");
  assert.equal(snap.nextBestAction, "complete_onboarding");
});

test("setup_complete_zero_bookings is not at_risk", () => {
  const snap = computeLifecycleSnapshot(
    facts({
      recordedBookings: 0,
      hadMeaningfulActivity: false,
      daysSinceLastActivity: 20,
    }),
  );
  assert.equal(snap.stage, "setup_complete_zero_bookings");
  assert.equal(snap.nextBestAction, "add_first_manual_booking");
});

test("manual_booking_only when there are bookings but no online ones", () => {
  const snap = computeLifecycleSnapshot(
    facts({ recordedBookings: 3, manualBookings: 3, onlineBookings: 0 }),
  );
  assert.equal(snap.stage, "manual_booking_only");
  assert.equal(snap.nextBestAction, "share_booking_link");
});

test("first_online_booking then building_habit then active", () => {
  assert.equal(
    computeLifecycleSnapshot(
      facts({ recordedBookings: 1, onlineBookings: 1 }),
    ).stage,
    "first_online_booking",
  );
  assert.equal(
    computeLifecycleSnapshot(
      facts({ recordedBookings: 5, onlineBookings: 2 }),
    ).stage,
    "building_habit",
  );
  assert.equal(
    computeLifecycleSnapshot(
      facts({
        recordedBookings: 12,
        onlineBookings: 4,
        completedBookings: 10,
        daysSinceLastActivity: 2,
        daysSinceLastBooking: 2,
      }),
    ).stage,
    "active",
  );
});

test("at_risk requires prior bookings, churned after long idle", () => {
  const atRisk = computeLifecycleSnapshot(
    facts({
      recordedBookings: 8,
      onlineBookings: 3,
      hadMeaningfulActivity: true,
      daysSinceLastActivity: 20,
      daysSinceLastBooking: 20,
    }),
  );
  assert.equal(atRisk.stage, "at_risk");
  assert.equal(atRisk.nextBestAction, "return_to_app");

  const churned = computeLifecycleSnapshot(
    facts({
      recordedBookings: 8,
      onlineBookings: 3,
      hadMeaningfulActivity: true,
      daysSinceLastActivity: 50,
      daysSinceLastBooking: 50,
    }),
  );
  assert.equal(churned.stage, "churned_or_dormant");
});

test("paid subscription wins over every other stage", () => {
  const snap = computeLifecycleSnapshot(
    facts({
      isPaid: true,
      recordedBookings: 0,
      onboardingComplete: false,
    }),
  );
  assert.equal(snap.stage, "subscribed");
  assert.equal(snap.nextBestAction, "none");
});

test("trial_ending overlays activation when trial is almost over", () => {
  const zero = computeLifecycleSnapshot(
    facts({
      isTrialing: true,
      trialEndsInDays: 3,
      recordedBookings: 0,
    }),
  );
  assert.equal(zero.stage, "trial_ending");
  assert.equal(zero.nextBestAction, "ask_problem");

  const active = computeLifecycleSnapshot(
    facts({
      isTrialing: true,
      trialEndsInDays: 2,
      recordedBookings: 12,
      onlineBookings: 4,
      monthlyBookings: 70,
      daysSinceLastBooking: 1,
    }),
  );
  assert.equal(active.stage, "trial_ending");
  assert.equal(active.nextBestAction, "analyze_upgrade");
});

test("google calendar is recommended only after 2 bookings", () => {
  const first = computeLifecycleSnapshot(
    facts({ recordedBookings: 1, onlineBookings: 1 }),
  );
  assert.equal(first.nextBestAction, "google_visibility");

  const later = computeLifecycleSnapshot(
    facts({ recordedBookings: 3, onlineBookings: 2 }),
  );
  assert.equal(later.nextBestAction, "connect_google_calendar");
});

test("frequency cap skips transactional emails and blocks extras", () => {
  const now = new Date("2026-09-09T12:00:00.000Z");
  const created = "2026-09-08T10:00:00.000Z";

  assert.equal(
    evaluateLifecycleFrequencyCap({
      isTransactional: true,
      sentAt: [now.toISOString()],
      now,
      contactCreatedAt: created,
    }).ok,
    true,
  );

  const daily = evaluateLifecycleFrequencyCap({
    isTransactional: false,
    sentAt: ["2026-09-09T08:00:00.000Z"],
    now,
    contactCreatedAt: created,
  });
  assert.equal(daily.ok, false);
  assert.equal(daily.reason, "frequency_min_gap");

  const firstWeek = evaluateLifecycleFrequencyCap({
    isTransactional: false,
    sentAt: [
      "2026-09-08T11:00:00.000Z",
      "2026-09-07T11:00:00.000Z",
      "2026-09-06T11:00:00.000Z",
    ],
    now,
    contactCreatedAt: "2026-09-03T10:00:00.000Z",
    minHoursBetween: 1,
  });
  assert.equal(firstWeek.ok, false);
  assert.equal(firstWeek.reason, "frequency_first_7_days");
});

test("historical catch-up is suppressed for overdue delays", () => {
  assert.equal(
    shouldSuppressHistoricalCatchup({
      enrolledAt: "2026-09-09T12:00:00.000Z",
      dueAt: "2026-09-01T12:00:00.000Z",
      delayMinutes: 2880,
    }),
    true,
  );
  assert.equal(
    shouldSuppressHistoricalCatchup({
      enrolledAt: "2026-09-09T12:00:00.000Z",
      dueAt: "2026-09-11T12:00:00.000Z",
      delayMinutes: 2880,
    }),
    false,
  );
});

test("highest priority automation wins", () => {
  const picked = pickHighestPriorityAutomation([
    { key: "google", priority: LIFECYCLE_PRIORITY.feature },
    { key: "welcome", priority: LIFECYCLE_PRIORITY.activation },
    { key: "blocker", priority: LIFECYCLE_PRIORITY.booking_blocker },
  ]);
  assert.equal(picked?.key, "blocker");
  assert.equal(
    automationPriorityForKey("subscription_activated"),
    LIFECYCLE_PRIORITY.transactional,
  );
});

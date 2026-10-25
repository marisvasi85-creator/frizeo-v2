import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildAdminNavItems } from "../app/admin/components/adminNav.ts";
import {
  canClientLeaveReview,
  summarizePublicReviews,
} from "../lib/reviews/eligibility.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function review(overrides) {
  return {
    id: "r1",
    tenantId: "salon-a",
    rating: 5,
    authorName: "Ana",
    comment: "Foarte bine",
    createdAt: "2026-10-01T10:00:00.000Z",
    approved: true,
    bookingId: "booking-1",
    bookingStatus: "confirmed",
    barberName: "Mihai",
    ...overrides,
  };
}

test("ratingul public numără toate recenziile eligibile, nu doar 50", () => {
  const rows = Array.from({ length: 51 }, (_, index) =>
    review({
      id: `r-${index}`,
      rating: index === 0 ? 1 : 5,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    }),
  );

  const summary = summarizePublicReviews(rows, "salon-a", 8);

  assert.equal(summary.count, 51);
  assert.equal(summary.average, 4.9);
  assert.equal(summary.reviews.length, 8);
  assert.equal(summary.reviews[0].id, "r-50");
});

test("recenzia fără comentariu rămâne în rating și în listă", () => {
  const summary = summarizePublicReviews(
    [review({ id: "silent", comment: null, rating: 4 })],
    "salon-a",
    8,
  );

  assert.equal(summary.count, 1);
  assert.equal(summary.average, 4);
  assert.equal(summary.reviews[0].comment, null);
});

test("recenzia unei programări anulate nu intră în ratingul public", () => {
  const summary = summarizePublicReviews(
    [
      review({ id: "ok", rating: 5 }),
      review({
        id: "cancelled",
        rating: 1,
        bookingStatus: "cancelled",
        createdAt: "2026-10-20T10:00:00.000Z",
      }),
    ],
    "salon-a",
    8,
  );

  assert.equal(summary.count, 1);
  assert.equal(summary.average, 5);
  assert.deepEqual(
    summary.reviews.map((item) => item.id),
    ["ok"],
  );
});

test("un salon nu vede recenziile altui salon", () => {
  const summary = summarizePublicReviews(
    [
      review({ id: "own", tenantId: "salon-a" }),
      review({ id: "other", tenantId: "salon-b", rating: 1 }),
    ],
    "salon-a",
    8,
  );

  assert.equal(summary.count, 1);
  assert.equal(summary.reviews[0].id, "own");
  assert.equal(summarizePublicReviews([], "salon-a", 8).count, 0);
  assert.equal(summarizePublicReviews([], "salon-a", 8).average, null);
});

test("o notă în afara intervalului 1-5 nu intră în medie", () => {
  const summary = summarizePublicReviews(
    [
      review({ id: "ok", rating: 5 }),
      review({ id: "bad", rating: 9, bookingId: "booking-2" }),
    ],
    "salon-a",
    8,
  );
  assert.equal(summary.count, 1);
  assert.equal(summary.average, 5);
});

test("o programare din alt salon nu intră în rating chiar dacă id-ul este prezent", () => {
  const summary = summarizePublicReviews(
    [
      review({ id: "linked", bookingId: "booking-1", bookingStatus: "confirmed" }),
      review({
        id: "foreign",
        bookingId: "booking-other",
        bookingStatus: null,
        rating: 1,
      }),
    ],
    "salon-a",
    8,
  );

  assert.equal(summary.count, 1);
  assert.equal(summary.reviews[0].id, "linked");
});

test("recenzia se poate trimite doar după ora de încheiere, în Europe/Bucharest", () => {
  const booking = {
    status: "confirmed",
    date: "2026-10-24",
    end_time: "18:00:00",
  };

  assert.equal(
    canClientLeaveReview(booking, new Date("2026-10-24T14:59:00.000Z")).ok,
    false,
  );
  assert.equal(
    canClientLeaveReview(booking, new Date("2026-10-24T15:00:00.000Z")).ok,
    true,
  );
  assert.match(
    canClientLeaveReview(
      { status: "cancelled", date: "2026-10-24", end_time: "18:00:00" },
      new Date("2026-10-24T16:00:00.000Z"),
    ).message,
    /anulată/,
  );
});

test("confirmarea primită înainte rămâne valabilă după încheierea programării", () => {
  const confirmedEarlier = {
    status: "confirmed",
    date: "2026-09-02T00:00:00.000Z",
    end_time: "11:30:00",
  };

  assert.equal(
    canClientLeaveReview(
      confirmedEarlier,
      new Date("2026-10-25T05:00:00.000Z"),
    ).ok,
    true,
  );
  assert.equal(
    canClientLeaveReview(
      confirmedEarlier,
      new Date("2026-09-02T08:29:00.000Z"),
    ).ok,
    false,
  );
});

test("meniul Recenzii salon este pentru owner și manager, separat de testimonialele Frizeo", () => {
  const owner = buildAdminNavItems({ role: "owner", actsAsBarber: false });
  const manager = buildAdminNavItems({
    role: "manager",
    actsAsBarber: false,
    platformTestimonialsEnabled: true,
  });
  const barber = buildAdminNavItems({
    role: "barber",
    actsAsBarber: true,
    platformTestimonialsEnabled: true,
  });
  const creator = buildAdminNavItems({
    role: "owner",
    actsAsBarber: true,
    assistantEnabled: true,
    platformAssistantEnabled: true,
    platformTestimonialsEnabled: true,
    frizeoEmailEnabled: true,
    accountDeletionsEnabled: true,
    accountingEnabled: true,
    billingRefundsEnabled: true,
  });

  assert.equal(owner.some((item) => item.href === "/admin/reviews"), true);
  assert.equal(manager.some((item) => item.href === "/admin/reviews"), true);
  assert.equal(manager.some((item) => item.href === "/admin/testimonials"), false);
  assert.equal(barber.some((item) => item.href === "/admin/reviews"), false);
  assert.equal(barber.some((item) => item.href === "/admin/testimonials"), false);
  assert.equal(
    owner.some((item) => item.href === "/admin/testimonials"),
    false,
  );

  const salonReviews = creator.findIndex((item) => item.href === "/admin/reviews");
  const testimonials = creator.findIndex(
    (item) => item.href === "/admin/testimonials",
  );
  assert.equal(creator[salonReviews]?.label, "Recenzii salon");
  assert.equal(creator[testimonials]?.label, "Recenzii");
  assert.equal(testimonials, salonReviews + 1);

  const page = readRepo("app/admin/reviews/page.tsx");
  assert.match(page, /canViewSalonReviews\(session\.role\)/);
  assert.match(page, /listSalonReviewsForAdmin\(\s*session\.tenantId/);
  assert.doesNotMatch(page, /searchParams/);
  assert.doesNotMatch(page, /marketing-testimonials/);
  assert.doesNotMatch(readRepo("lib/reviews/salonReviews.ts"), /Math\.max\(limit,\s*50\)/);
  assert.match(readRepo("app/api/reviews/create/route.ts"), /canClientLeaveReview/);
  assert.match(
    readRepo("app/api/bookings/confirm-meta/route.ts"),
    /buildClientCalendarLinks/,
  );
  assert.match(
    readRepo("app/booking/_components/BarberBookingView.tsx"),
    /SalonReviewsPublic/,
  );
  assert.match(readRepo("app/booking/_components/BarberBookingView.tsx"), /BookingClient/);
});

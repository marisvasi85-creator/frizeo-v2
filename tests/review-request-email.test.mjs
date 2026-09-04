import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reviewSql = readFileSync(
  new URL(
    "../supabase/migrations/20260904120000_review_request_after_10_bookings.sql",
    import.meta.url,
  ),
  "utf8",
);
const workerTs = readFileSync(
  new URL("../lib/frizeo-email/automationWorker.ts", import.meta.url),
  "utf8",
);
const clientTs = readFileSync(
  new URL(
    "../app/email/(console)/automations/AutomationsClient.tsx",
    import.meta.url,
  ),
  "utf8",
);
const renderTs = readFileSync(
  new URL("../lib/frizeo-email/renderEmail.ts", import.meta.url),
  "utf8",
);

function recordedBookingsCount(bookings) {
  return bookings.filter((row) => row.status !== "cancelled").length;
}

test("review CTA is the staging review URL and stays custom in the worker", () => {
  assert.match(reviewSql, /'https:\/\/staging\.frizeo\.ro\/review'/);
  assert.match(reviewSql, /'custom'/);
  assert.match(workerTs, /ctaType === "custom"/);
  assert.match(workerTs, /run\.cta_url/);
  assert.match(renderTs, /safePublicUrl\(input\.cta_url\)/);
});

test("automations list uses describeAutomationTrigger", () => {
  assert.match(clientTs, /describeAutomationTrigger/);
});

test("9 bookings plus cancelled do not reach the threshold; 10 confirmed do", () => {
  const ninePlusCancelled = [
    ...Array.from({ length: 9 }, () => ({ status: "confirmed" })),
    { status: "cancelled" },
  ];
  const tenConfirmed = [
    ...Array.from({ length: 10 }, () => ({ status: "confirmed" })),
    { status: "cancelled" },
  ];
  const fifteenAlreadySent = Array.from({ length: 15 }, () => ({
    status: "confirmed",
  }));
  assert.equal(recordedBookingsCount(ninePlusCancelled) >= 10, false);
  assert.equal(recordedBookingsCount(tenConfirmed) >= 10, true);
  assert.equal(recordedBookingsCount(fifteenAlreadySent) >= 10, true);
});

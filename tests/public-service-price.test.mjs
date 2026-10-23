import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  publicServiceChoiceMeta,
  visibleServicePriceLei,
} from "../lib/services/publicServicePrice.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bookingClient = readFileSync(
  join(root, "app/booking/[barberId]/components/BookingClient.tsx"),
  "utf8",
);
const serviceChoices = readFileSync(
  join(root, "app/booking/[barberId]/components/PublicServiceChoices.tsx"),
  "utf8",
);
const serviceModal = readFileSync(
  join(root, "app/admin/services/components/AddServiceModal.tsx"),
  "utf8",
);

test("public booking shows a saved price and hides an empty one", () => {
  assert.equal(
    publicServiceChoiceMeta({ duration: 45, price: 70, show_price: true }),
    "45 min · 70 lei",
  );
  assert.equal(
    publicServiceChoiceMeta({ duration: 45, price: "70.00", show_price: null }),
    "45 min · 70 lei",
  );
  assert.equal(
    publicServiceChoiceMeta({ duration: 30, price: 49.5, show_price: true }),
    "30 min · 49,50 lei",
  );
  assert.equal(
    visibleServicePriceLei({ price: 0, show_price: true }),
    "0 lei",
  );
  assert.equal(
    publicServiceChoiceMeta({ duration: 20, price: null, show_price: true }),
    "20 min",
  );
  assert.equal(
    publicServiceChoiceMeta({ duration: 20, price: "", show_price: true }),
    "20 min",
  );
  assert.equal(
    publicServiceChoiceMeta({ duration: 60, price: 100, show_price: false }),
    "60 min",
  );
});

test("public booking page renders the price before the client confirms", () => {
  assert.match(bookingClient, /<PublicServiceChoices/);
  assert.match(bookingClient, /<PublicBookingSelectionSummary/);
  assert.match(serviceChoices, /publicServiceChoiceMeta\(service\)/);
  assert.doesNotMatch(
    bookingClient,
    /\{s\.display_name\} \(\{s\.duration\} min\)/,
  );
  assert.match(serviceModal, /show_price: Boolean\(String\(price\)\.trim\(\)\)/);
});

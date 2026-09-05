import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const BOOKING_SLUG_MIN_LENGTH = 3;
const BOOKING_SLUG_MAX_LENGTH = 40;
const BOOKING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_BOOKING_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "billing",
  "booking",
  "dashboard",
  "help",
  "login",
  "new",
  "null",
  "preview",
  "profile",
  "settings",
  "signup",
  "staging",
  "static",
  "support",
  "undefined",
  "www",
]);

function parseBookingSlug(input) {
  const slug = slugify(input);
  if (!slug) {
    return {
      ok: false,
      error: "Introdu un nume pentru link (doar litere, cifre și cratime).",
    };
  }
  if (slug.length < BOOKING_SLUG_MIN_LENGTH) return { ok: false };
  if (slug.length > BOOKING_SLUG_MAX_LENGTH) return { ok: false };
  if (!BOOKING_SLUG_PATTERN.test(slug)) return { ok: false };
  if (RESERVED_BOOKING_SLUGS.has(slug)) return { ok: false };
  return { ok: true, slug };
}

function isBookingLinkCustomizationEnabled(env) {
  const explicit = env.BOOKING_LINK_CUSTOMIZATION_ENABLED?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;
  if (env.VERCEL_GIT_COMMIT_REF?.trim() === "staging") return true;
  if (env.VERCEL_ENV === "production") return false;
  if (env.NODE_ENV === "development") return true;
  return env.VERCEL_ENV === "preview";
}

test("slugify transliterates Romanian letters", () => {
  const source = readFileSync(
    new URL("../lib/utils/slugify.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /replace\(\/\[ăâ\]\/g, "a"\)/);
  assert.equal(slugify("Măriș Salon"), "maris-salon");
  assert.equal(slugify("Frizeria lui Ștefan"), "frizeria-lui-stefan");
  assert.equal(slugify("  Barber Shop!  "), "barber-shop");
});

test("parseBookingSlug accepts a custom handle and rejects junk", () => {
  const source = readFileSync(
    new URL("../lib/slugs/bookingSlug.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /RESERVED_BOOKING_SLUGS/);
  assert.match(source, /BOOKING_SLUG_MIN_LENGTH = 3/);
  assert.deepEqual(parseBookingSlug("Maris"), { ok: true, slug: "maris" });
  assert.equal(parseBookingSlug("ab").ok, false);
  assert.equal(parseBookingSlug("admin").ok, false);
  assert.equal(parseBookingSlug("---").ok, false);
  assert.match(parseBookingSlug("").error || "", /nume pentru link/);
});

test("customization is off on production unless explicitly enabled", () => {
  const source = readFileSync(
    new URL("../lib/slugs/bookingLinkCustomization.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /BOOKING_LINK_CUSTOMIZATION_ENABLED/);
  assert.match(source, /branch === "staging"/);
  assert.match(source, /VERCEL_ENV === "production"/);

  assert.equal(
    isBookingLinkCustomizationEnabled({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
    }),
    false,
  );
  assert.equal(
    isBookingLinkCustomizationEnabled({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "staging",
    }),
    true,
  );
  assert.equal(
    isBookingLinkCustomizationEnabled({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      BOOKING_LINK_CUSTOMIZATION_ENABLED: "true",
    }),
    true,
  );
});

test("dashboard and public booking pages keep old links via redirects", () => {
  const update = readFileSync(
    new URL("../lib/slugs/updateBookingSlug.ts", import.meta.url),
    "utf8",
  );
  const salonPage = readFileSync(
    new URL("../app/booking/salon/[slug]/page.tsx", import.meta.url),
    "utf8",
  );
  const barberPage = readFileSync(
    new URL("../app/booking/salon/[slug]/[barberSlug]/page.tsx", import.meta.url),
    "utf8",
  );
  const card = readFileSync(
    new URL("../app/admin/components/BookingLinkCard.tsx", import.meta.url),
    "utf8",
  );
  const actions = readFileSync(
    new URL("../app/admin/lib/bookingLinkActions.ts", import.meta.url),
    "utf8",
  );

  assert.match(update, /recordSlugRedirect/);
  assert.match(update, /clearOwnSlugRedirect/);
  assert.match(salonPage, /permanentRedirect/);
  assert.match(barberPage, /permanentRedirect/);
  assert.match(card, /Personalizează linkul/);
  assert.match(card, /redirecționează automat/);
  assert.match(actions, /isBookingLinkCustomizationEnabled/);
  assert.match(actions, /updateTenantBookingSlug/);
  assert.match(actions, /updateBarberBookingSlug/);
});

test("ensureBarberSlug never rewrites an existing slug on page load", () => {
  const source = readFileSync(
    new URL("../lib/barbers/ensureBarberSlug.ts", import.meta.url),
    "utf8",
  );
  const tenantEnsure = readFileSync(
    new URL("../lib/tenant/ensureTenantSlug.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /if \(barber\.slug\) \{\s*return barber\.slug;/);
  assert.match(tenantEnsure, /if \(tenant\.slug\) \{\s*return tenant\.slug;/);
});

test("allocation skips slugs reserved by redirects", () => {
  const tenantAlloc = readFileSync(
    new URL("../lib/tenant/allocateTenantSlug.ts", import.meta.url),
    "utf8",
  );
  const barberAlloc = readFileSync(
    new URL("../lib/barbers/allocateBarberSlug.ts", import.meta.url),
    "utf8",
  );
  const availability = readFileSync(
    new URL("../lib/slugs/slugAvailability.ts", import.meta.url),
    "utf8",
  );

  assert.match(tenantAlloc, /isTenantSlugAvailable/);
  assert.match(barberAlloc, /isBarberSlugAvailable/);
  assert.match(availability, /slug_redirects/);
  assert.match(availability, /entity_type", "tenant"/);
  assert.match(availability, /entity_type", "barber"/);
});

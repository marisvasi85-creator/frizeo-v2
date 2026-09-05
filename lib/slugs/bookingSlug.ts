import { slugify } from "@/lib/utils/slugify";

export const BOOKING_SLUG_MIN_LENGTH = 3;
export const BOOKING_SLUG_MAX_LENGTH = 40;
export const BOOKING_SLUG_CHANGE_LIMIT = 8;
export const BOOKING_SLUG_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;

const BOOKING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_BOOKING_SLUGS = new Set([
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

export type ParsedBookingSlug =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export function normalizeBookingSlug(input: string): string {
  return slugify(input);
}

export function parseBookingSlug(input: string): ParsedBookingSlug {
  const slug = normalizeBookingSlug(input);

  if (!slug) {
    return {
      ok: false,
      error: "Introdu un nume pentru link (doar litere, cifre și cratime).",
    };
  }

  if (slug.length < BOOKING_SLUG_MIN_LENGTH) {
    return {
      ok: false,
      error: `Numele din link trebuie să aibă cel puțin ${BOOKING_SLUG_MIN_LENGTH} caractere.`,
    };
  }

  if (slug.length > BOOKING_SLUG_MAX_LENGTH) {
    return {
      ok: false,
      error: `Numele din link poate avea cel mult ${BOOKING_SLUG_MAX_LENGTH} de caractere.`,
    };
  }

  if (!BOOKING_SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error: "Folosește doar litere, cifre și cratime, fără cratime la început sau sfârșit.",
    };
  }

  if (RESERVED_BOOKING_SLUGS.has(slug)) {
    return {
      ok: false,
      error: "Acest nume este rezervat. Alege altul.",
    };
  }

  return { ok: true, slug };
}

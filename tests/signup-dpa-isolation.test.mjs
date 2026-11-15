import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const protectedFiles = [
  "app/signup/page.tsx",
  "app/api/auth/signup/route.ts",
  "app/api/auth/login/route.ts",
  "app/admin/onboarding/page.tsx",
  "app/api/bookings/create/route.ts",
  "app/api/bookings/hold/route.ts",
  "app/api/bookings/cancel/route.ts",
  "app/api/bookings/reschedule/route.ts",
];

test("signup keeps separate unchecked terms and marketing consent", () => {
  const page = readRepo("app/signup/page.tsx");
  const route = readRepo("app/api/auth/signup/route.ts");
  assert.match(page, /useState\(false\)/);
  assert.match(page, /acceptedTerms/);
  assert.match(page, /marketingConsent/);
  assert.match(page, /href="\/terms"/);
  assert.match(page, /href="\/privacy"/);
  assert.match(route, /acceptedTerms/);
  assert.match(route, /if \(!acceptedTerms\)/);
  assert.match(route, /marketingConsent === true/);
  assert.doesNotMatch(page, /\/dpa/);
  assert.doesNotMatch(route, /salon_dpa_acceptances|DPA_ACCEPTANCE_ENABLED|dpa-proiect/);
});

test("signup, login, onboarding, and booking do not import the dpa flow", () => {
  for (const file of protectedFiles) {
    const source = readRepo(file);
    assert.doesNotMatch(source, /lib\/dpa|salon_dpa_acceptances|DPA_ACCEPTANCE_ENABLED/);
  }
});

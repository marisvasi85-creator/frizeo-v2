import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  loginQueryError,
  NO_SALON_ACCESS_MESSAGE,
} from "../lib/auth/credentials.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("login query errors explain missing salon access", () => {
  assert.equal(loginQueryError("access"), NO_SALON_ACCESS_MESSAGE);
  assert.match(loginQueryError("auth"), /expirat/i);
  assert.match(loginQueryError("email_sso"), /Frizeo Email/);
  assert.equal(loginQueryError(null), "");
  assert.equal(loginQueryError("unknown"), "");
});

test("login API rejects authenticated users without a salon", () => {
  const source = readFileSync(join(root, "app/api/auth/login/route.ts"), "utf8");
  assert.match(source, /NO_SALON_ACCESS_MESSAGE/);
  assert.match(source, /signOut\(\)/);
  assert.match(source, /status:\s*403/);
});

test("office@frizeo.ro is a default platform admin fallback", () => {
  const source = readFileSync(
    join(root, "lib/auth/requirePlatformAdmin.ts"),
    "utf8",
  );
  assert.match(source, /office@frizeo\.ro/);
  assert.match(source, /DEFAULT_PLATFORM_ADMIN_EMAILS/);
});

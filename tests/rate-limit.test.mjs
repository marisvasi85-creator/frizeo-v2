import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { resolveRateLimit } from "../lib/security/rateLimitDecision.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("rate limiter allows traffic when the RPC is down", () => {
  assert.equal(
    resolveRateLimit({
      allowed: null,
      errorMessage: "Could not find the function public.consume_api_rate_limit",
    }),
    "allow",
  );
  assert.equal(
    resolveRateLimit({ allowed: false, errorMessage: "timeout" }),
    "allow",
  );
});

test("rate limiter still blocks a confirmed over-limit result", () => {
  assert.equal(
    resolveRateLimit({ allowed: true, errorMessage: null }),
    "allow",
  );
  assert.equal(
    resolveRateLimit({ allowed: false, errorMessage: null }),
    "block",
  );
  assert.equal(
    resolveRateLimit({ allowed: null, errorMessage: null }),
    "block",
  );
});

test("login no longer maps limiter outages to a 503 that locks users out", () => {
  const source = readFileSync(join(root, "lib/security/rateLimit.ts"), "utf8");
  assert.match(source, /resolveRateLimit/);
  assert.doesNotMatch(
    source,
    /Serviciu temporar indisponibil/,
    "fail-closed 503 must not return from enforceRateLimit",
  );
  assert.match(source, /status: 429/);
});

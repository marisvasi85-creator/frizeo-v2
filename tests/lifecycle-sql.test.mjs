import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("lifecycle v2 is disabled by default and never flips is_active true", () => {
  const foundation = readRepo(
    "supabase/migrations/20260909120000_lifecycle_v2_foundation.sql",
  );
  const automations = readRepo(
    "supabase/migrations/20260909140000_lifecycle_v2_templates_and_automations.sql",
  );
  assert.match(foundation, /enabled boolean NOT NULL DEFAULT false/);
  assert.doesNotMatch(
    automations,
    /SET\s+is_active\s*=\s*true/i,
  );
  assert.match(automations, /is_active is never flipped to true/i);
});

test("discover uses v2 path only when the strategy flag is on", () => {
  const sql = readRepo(
    "supabase/migrations/20260909130000_lifecycle_v2_discover_and_claim.sql",
  );
  const foundation = readRepo(
    "supabase/migrations/20260909120000_lifecycle_v2_foundation.sql",
  );
  assert.match(sql, /marketing_lifecycle_strategy_enabled\(\)/);
  assert.match(sql, /discover_lifecycle_v2_runs/);
  assert.match(sql, /skip_reason = 'lower_priority'/);
  assert.match(foundation, /frequency_min_gap/);
  assert.match(sql, /lifecycle_stage_mismatch/);
  assert.match(sql, /objective_already_met/);
});

test("historical catch-up is skipped for delays before enrolled_at", () => {
  const sql = readRepo(
    "supabase/migrations/20260909130000_lifecycle_v2_discover_and_claim.sql",
  );
  assert.match(
    sql,
    /IF v_delay > 0 AND v_due < v_state\.enrolled_at THEN/,
  );
  assert.match(
    sql,
    /IF v_delay = 0 AND v_contact\.created_at < v_state\.enrolled_at/,
  );
});

test("cron worker still supports discover execute and all", () => {
  const route = readRepo("app/api/internal/marketing/automations/route.ts");
  assert.match(route, /mode === "all" \|\| mode === "discover"/);
  assert.match(route, /mode === "all" \|\| mode === "execute"/);
});

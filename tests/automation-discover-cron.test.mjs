import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function hasUnsafeUpdateLateral(sql) {
  return /UPDATE\s+public\.marketing_automation_runs\s+run[\s\S]{0,500}LATERAL\s+public\.marketing_automation_condition_ok\(\s*run\.contact_id/.test(
    sql,
  );
}

test("review-request migration reintroduced UPDATE LATERAL on run", () => {
  const sql = readRepo(
    "supabase/migrations/20260904120000_review_request_after_10_bookings.sql",
  );
  assert.equal(hasUnsafeUpdateLateral(sql), true);
});

test("follow-up discover migration uses CTE and includes review_after_10_bookings", () => {
  const sql = readRepo(
    "supabase/migrations/20260904180000_fix_discover_lateral_run_reference.sql",
  );
  assert.equal(hasUnsafeUpdateLateral(sql), false);
  assert.match(sql, /WITH to_skip AS/);
  assert.match(sql, /review_after_10_bookings/);
  assert.match(
    sql,
    /WHERE candidate\.last_activity IS NOT NULL/,
  );
});

test("earlier harden migration also avoids UPDATE LATERAL on run", () => {
  const sql = readRepo(
    "supabase/migrations/20260903091801_harden_automation_discover_scheduled_for.sql",
  );
  assert.equal(hasUnsafeUpdateLateral(sql), false);
  assert.match(sql, /WITH to_skip AS/);
});

test("mode=all keeps executing when discover throws", () => {
  const worker = readRepo("lib/frizeo-email/automationWorker.ts");
  const route = readRepo(
    "app/api/internal/marketing/automations/route.ts",
  );

  assert.match(worker, /discoverError/);
  assert.match(worker, /if \(!shouldExecute\) \{\s*throw error;/);
  assert.match(
    route,
    /success: !result\.discoverError/,
  );
});

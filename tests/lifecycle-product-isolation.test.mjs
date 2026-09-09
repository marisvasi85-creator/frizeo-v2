import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("dashboard stays up if lifecycle RPC errors or rejects", () => {
  const source = readRepo("app/admin/dashboard/page.tsx");
  assert.match(source, /lifecycleRes\.error/);
  assert.match(source, /lifecycle_rpc_failed/);
  assert.match(source, /lifecycle\?\.ok && lifecycle\.next_best_action/);
});

test("NextBestActionCard hides itself when there is nothing to show", () => {
  const source = readRepo("app/admin/components/NextBestActionCard.tsx");
  assert.match(source, /if \(!action \|\| action === "none"\) return null/);
});

test("booking hold still creates a timed hold and only adds created_via", () => {
  const source = readRepo("app/api/bookings/hold/route.ts");
  assert.match(source, /expires_at: expiresAt\.toISOString\(\)/);
  assert.match(source, /cancel_token: crypto\.randomUUID\(\)/);
  assert.match(
    source,
    /created_via: isDashboardBooking \? "dashboard" : "public"/,
  );
});

test("assistant bookings tag created_via without changing notification flow", () => {
  const source = readRepo("lib/assistant/tools/createBooking.ts");
  assert.match(source, /created_via: "assistant"/);
  assert.match(source, /await sendBookingNotifications\(/);
});

test("paid subscription automation stays outside lifecycle v2 gates", () => {
  const sql = readRepo(
    "supabase/migrations/20260909140000_lifecycle_v2_templates_and_automations.sql",
  );
  assert.match(
    sql,
    /'lifecycle_v2', false[\s\S]*WHERE automation_key = 'subscription_activated'/,
  );
});

test("v2 discover is a no-op until the strategy flag is on", () => {
  const sql = readRepo(
    "supabase/migrations/20260909130000_lifecycle_v2_discover_and_claim.sql",
  );
  assert.match(
    sql,
    /IF NOT public\.marketing_lifecycle_strategy_enabled\(\) THEN\s+RETURN 0;/,
  );
  assert.match(
    sql,
    /IF coalesce\(\(v_automation\.conditions ->> 'lifecycle_v2'\)::boolean, false\)\s+AND public\.marketing_lifecycle_strategy_enabled\(\)/,
  );
});

test("auth, stripe and booking confirmation mailers do not import lifecycle", () => {
  const isolated = [
    "lib/billing/syncStripeSubscription.ts",
    "lib/auth/getAdminSession.ts",
    "app/api/bookings/hold/route.ts",
    "lib/assistant/tools/createBooking.ts",
  ];
  for (const relativePath of isolated) {
    const source = readRepo(relativePath);
    assert.doesNotMatch(
      source,
      /frizeo-email\/lifecycle/,
      `${relativePath} must not import lifecycle`,
    );
  }
});

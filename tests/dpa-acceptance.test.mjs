import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dpaAcceptanceEnabled, dpaAcceptanceResponse } from "../lib/dpa/acceptance.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const owner = { userId: "user-a", role: "owner", tenantId: "tenant-a" };

test("dpa acceptance stays off and does not record anything", async () => {
  assert.equal(dpaAcceptanceEnabled({}), false);
  assert.equal(dpaAcceptanceEnabled({ DPA_ACCEPTANCE_ENABLED: "false" }), false);
  let called = false;
  const result = await dpaAcceptanceResponse({
    enabled: false,
    method: "POST",
    session: owner,
    requestedTenantId: "tenant-b",
    read: async () => { called = true; return false; },
    record: async () => { called = true; return true; },
  });
  assert.equal(result.status, 404);
  assert.equal(result.body.documentStatus, "draft");
  assert.equal(called, false);
});

test("an enabled acceptance uses only the signed-in salon and only an owner", async () => {
  const seen = [];
  const denied = await dpaAcceptanceResponse({
    enabled: true,
    method: "POST",
    session: { ...owner, role: "manager" },
    read: async () => false,
    record: async () => true,
  });
  assert.equal(denied.status, 403);
  const otherSalon = await dpaAcceptanceResponse({
    enabled: true,
    method: "POST",
    session: owner,
    requestedTenantId: "tenant-b",
    read: async () => false,
    record: async (tenantId) => { seen.push(tenantId); return true; },
  });
  assert.equal(otherSalon.status, 403);
  assert.deepEqual(seen, []);
  const saved = await dpaAcceptanceResponse({
    enabled: true,
    method: "POST",
    session: owner,
    requestedTenantId: "tenant-a",
    read: async () => false,
    record: async (tenantId, userId) => { seen.push(`${tenantId}:${userId}`); return true; },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.accepted, true);
  assert.deepEqual(seen, ["tenant-a:user-a"]);
});

test("dpa storage is tenant scoped and does not approve the draft", () => {
  const sql = readFileSync(
    join(root, "supabase/migrations/20261115141500_frizeo_v2_dpa_acceptance_draft.sql"),
    "utf8",
  );
  assert.match(sql, /get_current_tenant_id\(\)/);
  assert.match(sql, /get_current_role\(\) = 'owner'/);
  assert.match(sql, /accepted_by = auth.uid\(\)/);
  assert.equal(sql.includes("enable row level security"), true);
  const route = readFileSync(join(root, "app/api/salon/dpa/route.ts"), "utf8");
  assert.match(route, /dpaAcceptanceEnabled/);
  assert.equal(route.includes("redirect"), false);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildAdminNavItems } from "../app/admin/components/adminNav.ts";
import { dpaAcceptanceEnabled, dpaAcceptanceResponse } from "../lib/dpa/acceptance.ts";
import { DPA_CANONICAL_TEXT, DPA_DRAFT_VERSION, dpaDocumentHash } from "../lib/dpa/document.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const owner = { userId: "user-a", role: "owner", tenantId: "tenant-a" };
const hash = dpaDocumentHash();

function input(overrides = {}) {
  return {
    enabled: true,
    method: "POST",
    session: owner,
    accepted: true,
    presentedVersion: DPA_DRAFT_VERSION,
    presentedHash: hash,
    documentVersion: DPA_DRAFT_VERSION,
    documentHash: hash,
    read: async () => ({ accepted: false, acceptedAt: null, documentHash: null }),
    record: async () => ({ ok: true, acceptedAt: "2026-11-15T12:00:00.000Z" }),
    ...overrides,
  };
}

test("the public draft hash is the canonical file and keeps the 2021/915 version", () => {
  const file = readFileSync(join(root, "docs/DPA_PROIECT.md"), "utf8");
  assert.equal(file, DPA_CANONICAL_TEXT);
  assert.equal(DPA_DRAFT_VERSION, "dpa-proiect-2026-11-15-915");
  assert.match(file, /Decizia de punere în aplicare \(UE\) 2021\/915/);
  assert.match(file, /operator independent/);
  assert.match(file, /persoană împuternicită/);
  assert.equal(hash, createHash("sha256").update(file, "utf8").digest("hex"));
  assert.equal(hash.length, 64);
  const page = readFileSync(join(root, "app/dpa/page.tsx"), "utf8");
  assert.match(page, /dpaDocumentHash/);
  assert.doesNotMatch(page, /redirect\("\/login"\)/);
});

test("dpa acceptance stays off and does not record anything", async () => {
  assert.equal(dpaAcceptanceEnabled({}), false);
  assert.equal(dpaAcceptanceEnabled({ DPA_ACCEPTANCE_ENABLED: "false" }), false);
  let called = false;
  const result = await dpaAcceptanceResponse(input({
    enabled: false,
    requestedTenantId: "tenant-b",
    read: async () => { called = true; return { accepted: false, acceptedAt: null, documentHash: null }; },
    record: async () => { called = true; return { ok: true, acceptedAt: null }; },
  }));
  assert.equal(result.status, 404);
  assert.equal(result.body.documentStatus, "draft");
  assert.equal(called, false);
});

test("acceptance is explicit, hashed, and limited to the signed-in owner", async () => {
  const unchecked = await dpaAcceptanceResponse(input({ accepted: false }));
  assert.equal(unchecked.status, 400);
  const otherText = await dpaAcceptanceResponse(input({ presentedHash: "a".repeat(64) }));
  assert.equal(otherText.status, 409);
  const manager = await dpaAcceptanceResponse(input({
    session: { ...owner, role: "manager" },
  }));
  assert.equal(manager.status, 403);
  const seen = [];
  const otherSalon = await dpaAcceptanceResponse(input({
    requestedTenantId: "tenant-b",
    record: async (tenantId) => { seen.push(tenantId); return { ok: true, acceptedAt: "2026-11-15T12:00:00.000Z" }; },
  }));
  assert.equal(otherSalon.status, 403);
  const saved = await dpaAcceptanceResponse(input({
    record: async (tenantId, userId, documentHash) => {
      seen.push(`${tenantId}:${userId}:${documentHash}`);
      return { ok: true, acceptedAt: "2026-11-15T12:00:00.000Z" };
    },
  }));
  assert.equal(saved.status, 200);
  assert.equal(saved.body.accepted, true);
  assert.equal(saved.body.acceptedAt, "2026-11-15T12:00:00.000Z");
  assert.deepEqual(seen, [`tenant-a:user-a:${hash}`]);
});

test("the dashboard entry is owner-only and the checkbox starts unchecked", () => {
  const ownerNav = buildAdminNavItems({ role: "owner", actsAsBarber: false });
  const managerNav = buildAdminNavItems({ role: "manager", actsAsBarber: true });
  const barberNav = buildAdminNavItems({ role: "barber", actsAsBarber: true });
  assert.equal(ownerNav.some((item) => item.href === "/admin/dpa"), true);
  assert.equal(managerNav.some((item) => item.href === "/admin/dpa"), false);
  assert.equal(barberNav.some((item) => item.href === "/admin/dpa"), false);
  const form = readFileSync(join(root, "app/admin/dpa/DpaAcceptanceForm.tsx"), "utf8");
  assert.match(form, /useState\(false\)/);
  assert.doesNotMatch(form, /defaultChecked/);
  const sql = readFileSync(
    join(root, "supabase/migrations/20261115143000_frizeo_v2_dpa_document_hash.sql"),
    "utf8",
  );
  assert.match(sql, /dpa-proiect-2026-11-15-915/);
  assert.match(sql, /\^\[0-9a-f\]\{64\}\$/);
  const older = readFileSync(
    join(root, "supabase/migrations/20261115141500_frizeo_v2_dpa_acceptance_draft.sql"),
    "utf8",
  );
  assert.match(older, /get_current_tenant_id\(\)/);
  assert.match(older, /accepted_by = auth.uid\(\)/);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildAdminNavItems } from "../app/admin/components/adminNav.ts";
import {
  DPA_STAGING_ACCEPTANCE_TENANT_ID,
  dpaAcceptanceEnabledForTenant,
} from "../lib/dpa/access.ts";
import { dpaAcceptanceResponse, normalizeDpaIdentity } from "../lib/dpa/acceptance.ts";
import { DPA_CANONICAL_TEXT, DPA_VERSION, dpaDocumentHash } from "../lib/dpa/document.ts";
import { dpaVersionRecord } from "../lib/dpa/versions.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hash = dpaDocumentHash();
const owner = { userId: "user-a", role: "owner", tenantId: DPA_STAGING_ACCEPTANCE_TENANT_ID };
const identity = {
  legalName: "Demo Barber Salon SRL",
  cui: "47684690",
  address: "Arad, strada Test 1",
  representativeName: "Demo Owner",
  representativeConfirmed: true,
};

function input(overrides = {}) {
  return {
    enabled: true,
    method: "POST",
    session: owner,
    accepted: true,
    representativeConfirmed: true,
    presentedVersion: DPA_VERSION,
    presentedHash: hash,
    identity,
    documentVersion: DPA_VERSION,
    documentHash: hash,
    read: async () => ({
      accepted: false,
      acceptedAt: null,
      documentHash: null,
      legalName: null,
      representativeName: null,
      method: null,
    }),
    record: async () => ({
      ok: true,
      proof: {
        accepted: true,
        acceptedAt: "2026-11-15T12:40:00.000Z",
        documentHash: hash,
        legalName: identity.legalName,
        representativeName: identity.representativeName,
        method: "electronic_dashboard",
      },
    }),
    ...overrides,
  };
}

test("the public agreement hash matches the immutable version", () => {
  const file = readFileSync(join(root, "docs/dpa/versions/dpa-2026-11-15.md"), "utf8");
  assert.equal(file, DPA_CANONICAL_TEXT);
  assert.equal(readFileSync(join(root, "docs/DPA_PROIECT.md"), "utf8"), file);
  assert.equal(DPA_VERSION, "dpa-2026-11-15");
  assert.equal(hash, createHash("sha256").update(file, "utf8").digest("hex"));
  assert.equal(dpaVersionRecord(DPA_VERSION)?.text, file);
  assert.equal(dpaVersionRecord("missing"), null);
  assert.match(file, /autorizare generală scrisă/);
  assert.match(file, /30 de zile/);
  assert.match(file, /legea română/);
  assert.match(file, /nu adaugă nicio taxă/);
  assert.match(file, /operator independent/);
  assert.doesNotMatch(file, /proiect|nesemnat|nealeas|de completat/);
  const page = readFileSync(join(root, "app/dpa/page.tsx"), "utf8");
  assert.match(page, /dpaDocumentHash/);
  assert.doesNotMatch(page, /redirect\("\/login"\)/);
});

test("acceptance stays off for every salon except the staging test salon", () => {
  assert.equal(dpaAcceptanceEnabledForTenant({
    tenantId: DPA_STAGING_ACCEPTANCE_TENANT_ID,
    hostname: "staging.frizeo.ro",
    stagingRuntime: true,
  }), true);
  assert.equal(dpaAcceptanceEnabledForTenant({
    tenantId: "11111111-1111-4111-8111-111111111111",
    hostname: "staging.frizeo.ro",
    stagingRuntime: true,
  }), false);
  assert.equal(dpaAcceptanceEnabledForTenant({
    tenantId: DPA_STAGING_ACCEPTANCE_TENANT_ID,
    hostname: "www.frizeo.ro",
    stagingRuntime: false,
  }), false);
  assert.equal(dpaAcceptanceEnabledForTenant({
    tenantId: DPA_STAGING_ACCEPTANCE_TENANT_ID,
    hostname: "frizeo.ro",
    stagingRuntime: true,
  }), false);
});

test("a disabled salon records nothing", async () => {
  let called = false;
  const result = await dpaAcceptanceResponse(input({
    enabled: false,
    read: async () => { called = true; return input().read(); },
    record: async () => { called = true; return input().record(); },
  }));
  assert.equal(result.status, 404);
  assert.equal(called, false);
});

test("acceptance requires the owner, the shown document, and a representative", async () => {
  assert.equal((await dpaAcceptanceResponse(input({ accepted: false }))).status, 400);
  assert.equal((await dpaAcceptanceResponse(input({ representativeConfirmed: false }))).status, 400);
  assert.equal(normalizeDpaIdentity({ ...identity, legalName: "A" }), null);
  assert.equal((await dpaAcceptanceResponse(input({
    identity: { ...identity, address: "ab" },
  }))).status, 400);
  assert.equal((await dpaAcceptanceResponse(input({ presentedHash: "a".repeat(64) }))).status, 409);
  assert.equal((await dpaAcceptanceResponse(input({
    session: { ...owner, role: "manager" },
  }))).status, 403);
  assert.equal((await dpaAcceptanceResponse(input({
    session: { ...owner, role: "barber" },
  }))).status, 403);
  const seen = [];
  assert.equal((await dpaAcceptanceResponse(input({
    requestedTenantId: "11111111-1111-4111-8111-111111111111",
    record: async (tenantId) => { seen.push(tenantId); return input().record(); },
  }))).status, 403);
  const saved = await dpaAcceptanceResponse(input({
    record: async (tenantId, userId, documentHash, savedIdentity) => {
      seen.push(`${tenantId}:${userId}:${documentHash}:${savedIdentity.legalName}`);
      return input().record();
    },
  }));
  assert.equal(saved.status, 200);
  assert.equal(saved.body.accepted, true);
  assert.equal(saved.body.method, "electronic_dashboard");
  assert.deepEqual(seen, [`${owner.tenantId}:${owner.userId}:${hash}:${identity.legalName}`]);
});

test("a second acceptance returns the stored proof and does not write again", async () => {
  let writes = 0;
  const proof = {
    accepted: true,
    acceptedAt: "2026-11-15T12:40:00.000Z",
    documentHash: hash,
    legalName: identity.legalName,
    representativeName: identity.representativeName,
    method: "electronic_dashboard",
  };
  const result = await dpaAcceptanceResponse(input({
    read: async () => proof,
    record: async () => { writes += 1; return { ok: true, proof }; },
  }));
  assert.equal(result.status, 200);
  assert.equal(result.body.acceptedAt, proof.acceptedAt);
  assert.equal(writes, 0);
});

test("the dashboard entry is owner-only and the boxes start unchecked", () => {
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
    join(root, "supabase/migrations/20261115150000_frizeo_v2_dpa_electronic_acceptance.sql"),
    "utf8",
  );
  assert.match(sql, /dpa-2026-11-15/);
  assert.match(sql, /electronic_dashboard/);
  assert.match(sql, /representative_confirmed is true/);
  const older = readFileSync(
    join(root, "supabase/migrations/20261115141500_frizeo_v2_dpa_acceptance_draft.sql"),
    "utf8",
  );
  assert.match(older, /get_current_tenant_id\(\)/);
  assert.match(older, /accepted_by = auth.uid\(\)/);
});

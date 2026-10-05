import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildAdminNavItems } from "../app/admin/components/adminNav.ts";
import {
  FRIZEO_V2_CAPABILITIES,
  resolveCapabilities,
} from "../lib/integrations/capabilities.ts";
import {
  creditBalance,
  creditsForTenant,
  planCreditDebit,
} from "../lib/integrations/credits.ts";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "../lib/integrations/crypto.ts";
import { buildLabProviderStatus } from "../lib/integrations/labStatus.ts";
import {
  assertOAuthCallback,
  createOAuthState,
  pkceS256,
} from "../lib/integrations/oauth/state.ts";
import { canAdministerIntegrations, canAccessIntegrationLab } from "../lib/integrations/permissions.ts";
import { presentConnection } from "../lib/integrations/presentation.ts";
import { createMockPublishJob } from "../lib/integrations/publish/mockJob.ts";
import { getProviderAdapter } from "../lib/integrations/providers/registry.ts";
import { redactIntegrationRecord } from "../lib/integrations/redaction.ts";
import { monthlyUsageCost, usageForTenant } from "../lib/integrations/usage.ts";
import {
  planWebhookReceipt,
  webhookFoundationResponse,
} from "../lib/integrations/webhooks/foundation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(
  join(root, "supabase/migrations/20261005071701_frizeo_v2_integration_foundation.sql"),
  "utf8",
);

test("migration isolates connections and destinations by tenant", () => {
  assert.match(migration, /create policy marketing_connections_select/);
  assert.match(migration, /create policy marketing_destinations_select/);
  for (const policy of [
    "marketing_connections_select",
    "marketing_destinations_select",
  ]) {
    const start = migration.indexOf(`create policy ${policy}`);
    const slice = migration.slice(start, start + 400);
    assert.match(slice, /tenant_id = public\.get_current_tenant_id\(\)/);
    assert.match(slice, /owner', 'manager'/);
    assert.doesNotMatch(slice, /for insert/);
    assert.doesNotMatch(slice, /for update/);
    assert.doesNotMatch(slice, /for delete/);
  }
  assert.match(migration, /revoke all on table public\.marketing_connections from public, anon, authenticated/);
  assert.match(migration, /grant select on table public\.marketing_connections to authenticated/);
});

test("barber cannot administer integrations; owner and manager can", () => {
  assert.equal(canAdministerIntegrations("barber"), false);
  assert.equal(canAdministerIntegrations(null), false);
  assert.equal(canAdministerIntegrations("owner"), true);
  assert.equal(canAdministerIntegrations("manager"), true);

  const barber = buildAdminNavItems({ role: "barber", actsAsBarber: true });
  const manager = buildAdminNavItems({ role: "manager", actsAsBarber: true });
  const owner = buildAdminNavItems({ role: "owner", actsAsBarber: false });
  assert.equal(barber.some((item) => item.href === "/admin/settings/integrations"), false);
  assert.equal(manager.some((item) => item.href === "/admin/settings/integrations"), true);
  assert.equal(owner.some((item) => item.href === "/admin/settings/integrations"), true);
});

test("Integration Lab is limited to the platform creator", () => {
  const previous = process.env.PLATFORM_CREATOR_EMAILS;
  process.env.PLATFORM_CREATOR_EMAILS = "creator@example.com";
  try {
    assert.equal(canAccessIntegrationLab("creator@example.com"), true);
    assert.equal(canAccessIntegrationLab("owner@example.com"), false);
  } finally {
    if (previous == null) delete process.env.PLATFORM_CREATOR_EMAILS;
    else process.env.PLATFORM_CREATOR_EMAILS = previous;
  }

  const owner = buildAdminNavItems({ role: "owner", actsAsBarber: false });
  const creator = buildAdminNavItems({
    role: "owner",
    actsAsBarber: false,
    integrationLabEnabled: true,
  });
  const barber = buildAdminNavItems({
    role: "barber",
    actsAsBarber: true,
    integrationLabEnabled: true,
  });
  assert.equal(owner.some((item) => item.href === "/admin/integrations"), false);
  assert.equal(creator.some((item) => item.href === "/admin/integrations"), true);
  assert.equal(barber.some((item) => item.href === "/admin/integrations"), false);

  const page = readFileSync(join(root, "app/admin/integrations/page.tsx"), "utf8");
  assert.match(page, /canAccessIntegrationLab/);
  assert.match(page, /redirect\("\/admin\/dashboard"\)/);
});

test("tokens are absent from public responses and the settings UI", () => {
  const redacted = redactIntegrationRecord({
    provider: "meta",
    display_name: "Page",
    access_token: "secret-access",
    refresh_token: "secret-refresh",
    client_secret: "secret-client",
    ciphertext: "aabb",
    nested: { code_verifier: "verifier", status: "not_connected" },
  });
  assert.deepEqual(redacted, {
    provider: "meta",
    display_name: "Page",
    nested: { status: "not_connected" },
  });

  const settings = readFileSync(
    join(root, "app/admin/settings/integrations/page.tsx"),
    "utf8",
  );
  const lab = readFileSync(join(root, "app/admin/integrations/page.tsx"), "utf8");
  assert.match(settings, /id, provider, display_name, status, scopes/);
  assert.doesNotMatch(settings, /access_token/);
  assert.doesNotMatch(settings, /refresh_token/);
  assert.doesNotMatch(lab, /access_token/);
  assert.doesNotMatch(lab, /refresh_token/);
  assert.doesNotMatch(lab, /client_secret/);
  assert.match(migration, /create table if not exists private\.marketing_connection_secrets/);
  assert.doesNotMatch(
    migration.slice(
      migration.indexOf("create table if not exists public.marketing_connections"),
      migration.indexOf("create unique index"),
    ),
    /access_token/,
  );
});

test("Frizeo 2.0 capabilities are off unless explicitly enabled", () => {
  const defaults = resolveCapabilities([]);
  for (const capability of FRIZEO_V2_CAPABILITIES) {
    assert.equal(defaults[capability], false);
  }
  const enabled = resolveCapabilities([
    { capability: "growth.recall", enabled: true },
    { capability: "plan === \"pro\"", enabled: true },
  ]);
  assert.equal(enabled["growth.recall"], true);
  assert.equal(enabled["booking.core"], false);
  assert.equal(enabled["marketing.publish.meta"], false);
});

test("mock publish jobs and adapters do not call providers", async () => {
  const job = createMockPublishJob({ provider: "meta" });
  assert.equal(job.status, "draft");
  assert.equal(job.externalCall, false);
  assert.equal(job.providerPostId, null);
  const adapter = getProviderAdapter("tiktok");
  assert.deepEqual(await adapter.publish(), {
    implemented: false,
    reason: "not_implemented",
  });
  assert.deepEqual(await adapter.getDestinations(), {
    implemented: false,
    reason: "not_implemented",
  });
});

test("webhook receipts are deny-by-default and idempotent", async () => {
  const response = webhookFoundationResponse();
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "not_configured" });
  for (const provider of ["meta", "tiktok", "whatsapp"]) {
    const route = readFileSync(
      join(root, `app/api/webhooks/${provider}/route.ts`),
      "utf8",
    );
    assert.match(route, /webhookFoundationResponse/);
    assert.doesNotMatch(route, /signature/);
  }
  assert.deepEqual(
    planWebhookReceipt({
      existingExternalIds: ["evt-1"],
      externalEventId: "evt-1",
    }).action,
    "duplicate",
  );
  assert.equal(
    planWebhookReceipt({
      existingExternalIds: [],
      externalEventId: "evt-2",
    }).action,
    "record",
  );
  assert.match(migration, /unique \(provider, external_event_id\)/);
  assert.doesNotMatch(migration, /raw_payload/);
});

test("usage and credits stay inside the tenant", () => {
  const usage = [
    entry("tenant-a", "2026-10-01T00:00:00.000Z", 100),
    entry("tenant-b", "2026-10-02T00:00:00.000Z", 900),
  ];
  assert.equal(usageForTenant(usage, "tenant-a").length, 1);
  assert.deepEqual(monthlyUsageCost({ entries: usage, tenantId: "tenant-a", month: "2026-10" }), {
    estimatedCostMinor: 100,
    currency: "EUR",
  });

  const credits = [
    { tenantId: "tenant-a", entryType: "included_grant", amount: 10, idempotencyKey: "g1", expiresAt: null },
    { tenantId: "tenant-b", entryType: "included_grant", amount: 50, idempotencyKey: "g2", expiresAt: null },
  ];
  assert.equal(creditsForTenant(credits, "tenant-a").length, 1);
  assert.equal(creditBalance(credits, "tenant-a"), 10);
  const debit = planCreditDebit({
    entries: credits,
    tenantId: "tenant-a",
    amount: 4,
    idempotencyKey: "d1",
  });
  assert.equal(debit.ok, true);
  if (debit.ok) assert.equal(debit.entry.amount, -4);
  const duplicate = planCreditDebit({
    entries: [...credits, debit.ok ? debit.entry : credits[0]],
    tenantId: "tenant-a",
    amount: 4,
    idempotencyKey: "d1",
  });
  assert.equal(duplicate.ok && duplicate.duplicate, true);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /insufficient_credits/);
});

test("an expired grant does not let its debit reduce a later grant", () => {
  const spent = [
    creditRow({
      idempotencyKey: "g1",
      amount: 10,
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-02-01T00:00:00.000Z",
    }),
    creditRow({
      entryType: "debit",
      idempotencyKey: "d1",
      amount: -4,
      createdAt: "2026-01-15T00:00:00.000Z",
      expiresAt: null,
    }),
  ];
  assert.equal(
    creditBalance(spent, "tenant-a", new Date("2026-01-20T00:00:00.000Z")),
    6,
  );
  assert.equal(
    creditBalance(spent, "tenant-a", new Date("2026-03-01T00:00:00.000Z")),
    0,
  );
  const renewed = [
    ...spent,
    creditRow({
      idempotencyKey: "g2",
      amount: 10,
      createdAt: "2026-03-02T00:00:00.000Z",
      expiresAt: null,
    }),
  ];
  assert.equal(
    creditBalance(renewed, "tenant-a", new Date("2026-03-03T00:00:00.000Z")),
    10,
  );
  assert.equal(
    planCreditDebit({
      entries: spent,
      tenantId: "tenant-a",
      amount: 1,
      idempotencyKey: "too-late",
      now: new Date("2026-03-01T00:00:00.000Z"),
    }).ok,
    false,
  );
});

test("integrity migration guards tenants, campaign assets, and nested secrets", () => {
  const integrity = readFileSync(
    join(root, "supabase/migrations/20261005085530_frizeo_v2_integration_integrity.sql"),
    "utf8",
  );
  assert.match(integrity, /connection secret tenant mismatch/);
  assert.match(integrity, /campaign barber tenant mismatch/);
  assert.match(integrity, /if new\.barber_id is null/);
  assert.match(integrity, /publish job asset campaign mismatch/);
  assert.match(integrity, /publish job tenant mismatch/);
  assert.match(integrity, /json_contains_secret_key/);
  assert.match(integrity, /'access_token'/);
  assert.match(integrity, /'pkce_verifier'/);
  assert.doesNotMatch(integrity, /raise exception '%'/);
  assert.match(integrity, /private\.credit_balance/);
});

test("OAuth callback rejects a different tenant", () => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const issued = createOAuthState({
    tenantId: "tenant-a",
    userId: "user-a",
    provider: "meta",
    now: new Date("2026-10-05T00:00:00.000Z"),
  });
  assert.equal("error" in issued, false);
  if ("error" in issued) return;
  assert.equal(pkceS256(issued.pkceVerifier), issued.pkceChallenge);
  const switched = assertOAuthCallback({
    presentedState: issued.state,
    storedStateHash: issued.stateHash,
    storedTenantId: issued.tenantId,
    sessionTenantId: "tenant-b",
    storedUserId: issued.userId,
    sessionUserId: issued.userId,
    storedProvider: "meta",
    presentedProvider: "meta",
    expiresAt: issued.expiresAt,
    consumedAt: null,
    now: new Date("2026-10-05T00:01:00.000Z"),
  });
  assert.deepEqual(switched, { ok: false, reason: "tenant_mismatch" });
  const same = assertOAuthCallback({
    presentedState: issued.state,
    storedStateHash: issued.stateHash,
    storedTenantId: issued.tenantId,
    sessionTenantId: issued.tenantId,
    storedUserId: issued.userId,
    sessionUserId: issued.userId,
    storedProvider: "meta",
    presentedProvider: "meta",
    expiresAt: issued.expiresAt,
    consumedAt: null,
    now: new Date("2026-10-05T00:01:00.000Z"),
  });
  assert.deepEqual(same, { ok: true });
});

test("token encryption round-trips and the UI never shows a mock as connected", () => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  const encrypted = encryptIntegrationSecret("access-token-value");
  assert.equal("error" in encrypted, false);
  if ("error" in encrypted) return;
  assert.equal(decryptIntegrationSecret(encrypted), "access-token-value");
  assert.equal(encrypted.ciphertext.includes(Buffer.from("access-token-value")), false);

  const comingSoon = presentConnection(null);
  assert.equal(comingSoon.label, "Neconectat");
  assert.equal(comingSoon.comingSoon, true);
  assert.equal(comingSoon.connectDisabled, true);
  assert.notEqual(comingSoon.label, "Conectat");
});

test("lab status hides unsafe errors and does not claim a live provider", () => {
  const status = buildLabProviderStatus({
    provider: "meta",
    explicitEnables: [],
    connectionsCount: 0,
    destinationsCount: 0,
    lastValidation: null,
    lastError: "access_token=abc",
  });
  assert.equal(status.feature, "disabled");
  assert.equal(status.oauth, "not_implemented");
  assert.equal(status.publish, "not_implemented");
  assert.match(status.lastSafeError, /omise/);
});

test("foundation does not import booking, billing, calendar, or Marketing AI", () => {
  const files = [
    "lib/integrations/capabilities.ts",
    "lib/integrations/oauth/state.ts",
    "lib/integrations/providers/registry.ts",
    "app/admin/settings/integrations/page.tsx",
    "app/admin/integrations/page.tsx",
    "app/api/webhooks/meta/route.ts",
  ];
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(source, /lib\/billing|lib\/google\/|lib\/marketing-ai|stripe/);
  }
  assert.match(readFileSync(join(root, "lib/marketing-ai/access.ts"), "utf8"), /resolveMarketingBarberId/);
  assert.match(readFileSync(join(root, "lib/google/createEvent.ts"), "utf8"), /calendar/);
});

function creditRow({
  entryType = "included_grant",
  idempotencyKey,
  amount,
  createdAt,
  expiresAt,
}) {
  return {
    tenantId: "tenant-a",
    entryType,
    amount,
    idempotencyKey,
    expiresAt,
    createdAt,
  };
}

function entry(tenantId, createdAt, estimatedCostMinor) {
  return {
    tenantId,
    userId: null,
    feature: "studio.hair_preview",
    provider: "none",
    model: null,
    units: 1,
    inputTokens: null,
    outputTokens: null,
    creditsUsed: 0,
    estimatedCostMinor,
    currency: "EUR",
    createdAt,
  };
}

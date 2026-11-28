import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FRIZEO_V2_CAPABILITIES,
  resolveCapabilities,
  STAGING_META_OWNER_ACCESS_ENV,
  stagingMetaOwnerAccessEnabled,
} from "../lib/integrations/capabilities.ts";
import {
  RESET_PASSWORD_GENERIC_ERROR,
  RESET_PASSWORD_RATE_LIMIT_ERROR,
  RESET_PASSWORD_SENT_MESSAGE,
  resetPasswordFailure,
} from "../lib/auth/passwordReset.ts";
import { publishRequestDecision } from "../lib/integrations/meta/publish/flags.ts";

const stagingOn = { stagingMetaOwnerAccess: true };

test("production and non-staging never default Meta on", () => {
  assert.equal(
    stagingMetaOwnerAccessEnabled({}, { production: true, staging: true }),
    false,
  );
  assert.equal(
    stagingMetaOwnerAccessEnabled(
      { [STAGING_META_OWNER_ACCESS_ENV]: "true" },
      { production: true, staging: false },
    ),
    false,
  );
  assert.equal(
    stagingMetaOwnerAccessEnabled({}, { production: false, staging: false }),
    false,
  );
  const production = resolveCapabilities([], { stagingMetaOwnerAccess: false });
  for (const capability of FRIZEO_V2_CAPABILITIES) {
    assert.equal(production[capability], false);
  }
});

test("staging owners get Meta connect and live unless a row or the env turns them off", () => {
  assert.equal(
    stagingMetaOwnerAccessEnabled({}, { production: false, staging: true }),
    true,
  );
  for (const value of ["false", "0", "off"]) {
    assert.equal(
      stagingMetaOwnerAccessEnabled(
        { [STAGING_META_OWNER_ACCESS_ENV]: value },
        { production: false, staging: true },
      ),
      false,
    );
  }
  const opened = resolveCapabilities([], stagingOn);
  assert.equal(opened["marketing.publish.meta"], true);
  assert.equal(opened["marketing.publish.meta.live"], true);
  assert.equal(opened["marketing.publish.google_business"], false);
  assert.equal(opened["marketing.publish.tiktok"], false);
  assert.equal(opened["booking.core"], false);

  const killed = resolveCapabilities(
    [
      { capability: "marketing.publish.meta.live", enabled: false },
    ],
    stagingOn,
  );
  assert.equal(killed["marketing.publish.meta"], true);
  assert.equal(killed["marketing.publish.meta.live"], false);

  const explicit = resolveCapabilities(
    [{ capability: "marketing.publish.meta", enabled: true }],
    { stagingMetaOwnerAccess: false },
  );
  assert.equal(explicit["marketing.publish.meta"], true);
  assert.equal(explicit["marketing.publish.meta.live"], false);
});

test("another tenant's rows are not part of this tenant's resolution", () => {
  const tenantA = resolveCapabilities(
    [{ capability: "marketing.publish.meta", enabled: false }],
    stagingOn,
  );
  const tenantB = resolveCapabilities([], stagingOn);
  assert.equal(tenantA["marketing.publish.meta"], false);
  assert.equal(tenantB["marketing.publish.meta"], true);
});

test("server checks use the shared reader and keep the live gates", () => {
  const http = readFileSync("lib/integrations/meta/http.ts", "utf8");
  const handlers = readFileSync("lib/integrations/meta/publish/handlers.ts", "utf8");
  const reader = readFileSync("lib/integrations/meta/tenantAccess.ts", "utf8");
  const publishPage = readFileSync("app/admin/marketing/publish/page.tsx", "utf8");
  const settings = readFileSync("app/admin/settings/integrations/page.tsx", "utf8");
  assert.match(http, /readMetaTenantCapabilities/);
  assert.match(handlers, /readMetaTenantCapabilities/);
  assert.match(reader, /\.eq\("tenant_id", tenantId\)/);
  assert.match(reader, /if \(error \|\| !data\) return closed/);
  assert.doesNotMatch(reader, /5d9862a1-fd85-46f2-9c7e-635e813e067c/);
  assert.match(publishPage, /currentStagingMetaOwnerAccess/);
  assert.match(settings, /currentStagingMetaOwnerAccess/);
  assert.match(publishPage, /production \? false : liveAvailable/);
  const decision = publishRequestDecision({
    production: true,
    hostIsStaging: true,
    originAllowed: true,
    authenticated: true,
    role: "owner",
    integrationEnabled: true,
    liveCapabilityEnabled: true,
    envLiveEnabled: true,
    configured: true,
    action: "live",
  });
  assert.equal(decision.ok, false);
  const barber = publishRequestDecision({
    production: false,
    hostIsStaging: true,
    originAllowed: true,
    authenticated: true,
    role: "barber",
    integrationEnabled: true,
    liveCapabilityEnabled: true,
    envLiveEnabled: true,
    configured: true,
    action: "live",
  });
  assert.equal(barber.ok, false);
});

test("password reset distinguishes the rate limit and does not reveal whether the account exists", () => {
  assert.deepEqual(resetPasswordFailure(null), { ok: true });
  assert.deepEqual(
    resetPasswordFailure({ code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 58 seconds." }),
    { ok: false, status: 429, error: RESET_PASSWORD_RATE_LIMIT_ERROR },
  );
  assert.equal(resetPasswordFailure({ status: 429 }).status, 429);
  const generic = resetPasswordFailure({ message: "Error sending recovery email" });
  assert.equal(generic.ok, false);
  if (!generic.ok) {
    assert.equal(generic.status, 400);
    assert.equal(generic.error, RESET_PASSWORD_GENERIC_ERROR);
    assert.equal(generic.error.includes("nu există"), false);
  }
  const login = readFileSync("app/login/page.tsx", "utf8");
  const route = readFileSync("app/api/auth/reset-password/route.ts", "utf8");
  const callback = readFileSync("app/auth/callback/route.ts", "utf8");
  assert.match(login, /disabled=\{resetting \|\| resetLocked\}/);
  assert.match(login, /if \(resetting \|\| resetLocked\) return/);
  assert.match(login, /RESET_PASSWORD_SENT_MESSAGE/);
  assert.equal(RESET_PASSWORD_SENT_MESSAGE.includes("Dacă există un cont"), true);
  assert.match(route, /getAppUrl\(\)/);
  assert.match(route, /\/auth\/callback\?next=\/reset-password/);
  assert.match(callback, /next\.startsWith\("\/"\)/);
  assert.match(callback, /exchangeCodeForSession/);
});

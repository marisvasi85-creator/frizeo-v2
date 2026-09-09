import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const PRODUCTION_HOSTS = new Set([
  "www.frizeo.ro",
  "frizeo.ro",
  "email.frizeo.ro",
]);
const STAGING_HOSTS = new Set(["staging.frizeo.ro"]);
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "email.localhost",
  "email.local",
]);

function normalizeHostname(hostname) {
  return (hostname ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
}

function isProductionHostname(hostname) {
  return PRODUCTION_HOSTS.has(normalizeHostname(hostname));
}

function isStagingHostname(hostname) {
  return STAGING_HOSTS.has(normalizeHostname(hostname));
}

function isPreviewHostname(hostname) {
  return normalizeHostname(hostname).endsWith(".vercel.app");
}

function isLocalHostname(hostname) {
  return LOCAL_HOSTS.has(normalizeHostname(hostname));
}

function envFlag(env, name) {
  const value = String(env[name] ?? "")
    .trim()
    .toLowerCase();
  return value === "true" || value === "1";
}

function vercelEnv(env) {
  return String(env.VERCEL_ENV || env.NEXT_PUBLIC_VERCEL_ENV || "").trim();
}

function gitBranch(env) {
  return String(
    env.VERCEL_GIT_COMMIT_REF || env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || "",
  ).trim();
}

function isDevelopment(env) {
  if (vercelEnv(env) === "development") return true;
  return !vercelEnv(env) && env.NODE_ENV === "development";
}

function isStaging(env) {
  if (gitBranch(env) === "staging") return true;
  const appUrl = String(env.NEXT_PUBLIC_APP_URL || "").toLowerCase();
  if (appUrl.includes("staging.frizeo.ro")) return true;
  const vercelUrl = String(
    env.VERCEL_URL || env.NEXT_PUBLIC_VERCEL_URL || "",
  ).toLowerCase();
  return vercelUrl.includes("staging.frizeo.ro");
}

function isPreview(env) {
  if (isStaging(env)) return false;
  return vercelEnv(env) === "preview";
}

function isProduction(env) {
  if (isStaging(env) || isPreview(env) || isDevelopment(env)) return false;
  if (vercelEnv(env) === "production") return true;
  return !vercelEnv(env) && env.NODE_ENV === "production";
}

function shouldSkipBackgroundJobs(env, hostname) {
  const jobsEnabled = envFlag(env, "STAGING_BACKGROUND_JOBS_ENABLED");
  if (jobsEnabled) return false;
  if (hostname) {
    if (isProductionHostname(hostname)) return false;
    if (isLocalHostname(hostname)) return false;
    if (isStagingHostname(hostname) || isPreviewHostname(hostname)) return true;
  }
  if (isProduction(env) || isDevelopment(env)) return false;
  if (isStaging(env) || isPreview(env)) return true;
  return false;
}

function isMarketingAnalyticsEnabled(env, hostname) {
  const override =
    envFlag(env, "STAGING_ANALYTICS_ENABLED") ||
    envFlag(env, "NEXT_PUBLIC_STAGING_ANALYTICS_ENABLED");
  if (hostname) {
    if (isProductionHostname(hostname)) return true;
    if (
      isStagingHostname(hostname) ||
      isPreviewHostname(hostname) ||
      isLocalHostname(hostname)
    ) {
      return override;
    }
  }
  if (isProduction(env)) return true;
  if (isStaging(env) || isPreview(env) || isDevelopment(env)) return override;
  return false;
}

const productionEnv = {
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_REF: "main",
  NODE_ENV: "production",
};

const stagingPreviewEnv = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "staging",
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://staging.frizeo.ro",
};

const stagingAsVercelProductionEnv = {
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_REF: "staging",
  NODE_ENV: "production",
};

const otherPreviewEnv = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "feat/p1",
  NODE_ENV: "production",
};

test("environment helpers distinguish production, staging, preview, development", () => {
  assert.equal(isProduction(productionEnv), true);
  assert.equal(isStaging(productionEnv), false);
  assert.equal(isPreview(productionEnv), false);
  assert.equal(isDevelopment(productionEnv), false);

  assert.equal(isStaging(stagingPreviewEnv), true);
  assert.equal(isProduction(stagingPreviewEnv), false);
  assert.equal(isPreview(stagingPreviewEnv), false);

  assert.equal(isStaging(stagingAsVercelProductionEnv), true);
  assert.equal(isProduction(stagingAsVercelProductionEnv), false);

  assert.equal(isPreview(otherPreviewEnv), true);
  assert.equal(isStaging(otherPreviewEnv), false);
  assert.equal(isProduction(otherPreviewEnv), false);

  assert.equal(
    isDevelopment({ NODE_ENV: "development" }),
    true,
  );
  assert.equal(
    isProduction({ NODE_ENV: "development" }),
    false,
  );
});

test("production background jobs run without STAGING_BACKGROUND_JOBS_ENABLED", () => {
  assert.equal(shouldSkipBackgroundJobs(productionEnv, "www.frizeo.ro"), false);
  assert.equal(shouldSkipBackgroundJobs(productionEnv, "email.frizeo.ro"), false);
  assert.equal(shouldSkipBackgroundJobs(productionEnv, "frizeo.ro"), false);
  assert.equal(shouldSkipBackgroundJobs(productionEnv), false);
});

test("staging and preview skip background jobs until the QA flag is on", () => {
  assert.equal(
    shouldSkipBackgroundJobs(stagingPreviewEnv, "staging.frizeo.ro"),
    true,
  );
  assert.equal(
    shouldSkipBackgroundJobs(otherPreviewEnv, "frizeo-git-feat-p1.vercel.app"),
    true,
  );
  assert.equal(
    shouldSkipBackgroundJobs(
      { ...stagingPreviewEnv, STAGING_BACKGROUND_JOBS_ENABLED: "true" },
      "staging.frizeo.ro",
    ),
    false,
  );
  assert.equal(
    shouldSkipBackgroundJobs(
      { ...productionEnv, STAGING_BACKGROUND_JOBS_ENABLED: "false" },
      "www.frizeo.ro",
    ),
    false,
  );
});

test("local development still runs jobs so QA can hit cron endpoints", () => {
  assert.equal(
    shouldSkipBackgroundJobs({ NODE_ENV: "development" }, "localhost"),
    false,
  );
  assert.equal(
    shouldSkipBackgroundJobs(stagingPreviewEnv, "localhost"),
    false,
  );
});

test("production analytics stay on; staging/preview stay off unless override", () => {
  assert.equal(isMarketingAnalyticsEnabled(productionEnv, "www.frizeo.ro"), true);
  assert.equal(
    isMarketingAnalyticsEnabled(productionEnv, "email.frizeo.ro"),
    true,
  );
  assert.equal(
    isMarketingAnalyticsEnabled(stagingPreviewEnv, "staging.frizeo.ro"),
    false,
  );
  assert.equal(
    isMarketingAnalyticsEnabled(
      {
        ...stagingPreviewEnv,
        NEXT_PUBLIC_STAGING_ANALYTICS_ENABLED: "true",
      },
      "staging.frizeo.ro",
    ),
    true,
  );
});

test("shared environment module is the single source for job skip + analytics", () => {
  const envSource = readRepo("lib/app/environment.ts");
  assert.match(envSource, /export function isProduction\(/);
  assert.match(envSource, /export function isStaging\(/);
  assert.match(envSource, /export function isPreview\(/);
  assert.match(envSource, /export function isDevelopment\(/);
  assert.match(envSource, /STAGING_BACKGROUND_JOBS_ENABLED/);
  assert.match(envSource, /shouldSkipBackgroundJobs/);
  assert.match(envSource, /isMarketingAnalyticsEnabled/);
});

const backgroundJobRoutes = [
  "app/api/internal/marketing/worker/route.ts",
  "app/api/internal/marketing/automations/route.ts",
  "app/api/cron/reminder/route.ts",
  "app/api/cron/cleanup/route.ts",
  "app/api/cron/trial-cleanup/route.ts",
  "app/api/cron/notion-sync/route.ts",
];

test("background job routes skip after auth and keep the endpoint", () => {
  for (const relativePath of backgroundJobRoutes) {
    const source = readRepo(relativePath);
    assert.match(
      source,
      /skipBackgroundJobsIfDisabled/,
      `${relativePath} must use the shared skip helper`,
    );
    const authCall = source.search(
      /isAuthorized(?:Cron|MarketingWorker)\(/,
    );
    const skipCall = source.indexOf("skipBackgroundJobsIfDisabled(");
    assert.ok(authCall >= 0, `${relativePath} still authenticates`);
    assert.ok(
      skipCall > authCall,
      `${relativePath} must skip only after auth`,
    );
    assert.match(source, /Unauthorized/);
  }

  const helper = readRepo("lib/app/backgroundJobs.ts");
  assert.match(helper, /disabled_on_staging/);
  assert.match(helper, /skipped: true/);
});

test("production sending and booking paths are not gated by the staging jobs flag", () => {
  const untouched = [
    "lib/email/email.ts",
    "app/api/bookings/create/route.ts",
    "app/api/bookings/hold/route.ts",
    "app/api/bookings/cancel/route.ts",
    "app/api/bookings/reschedule/route.ts",
    "app/api/slots/route.ts",
    "app/api/availability/route.ts",
    "app/api/email/campaigns/[id]/send-test/route.ts",
    "app/api/email/automations/[id]/send-test/route.ts",
    "app/api/webhooks/resend/marketing/route.ts",
    "app/api/billing/webhook/route.ts",
    "app/api/google/sync-bookings/route.ts",
  ];

  for (const relativePath of untouched) {
    const source = readRepo(relativePath);
    assert.doesNotMatch(
      source,
      /shouldSkipBackgroundJobs|skipBackgroundJobsIfDisabled|STAGING_BACKGROUND_JOBS_ENABLED/,
      `${relativePath} must stay independent of the staging jobs flag`,
    );
  }
});

test("first-party analytics ingest skips staging writes into the production dataset", () => {
  const ingest = readRepo("app/api/analytics/events/route.ts");
  assert.match(ingest, /isMarketingAnalyticsEnabled/);
  assert.match(ingest, /disabled_on_staging/);
  assert.match(ingest, /marketing_traffic_events/);

  const client = readRepo("lib/analytics/firstParty.ts");
  assert.match(client, /isMarketingAnalyticsEnabled\(\)/);

  const config = readRepo("lib/analytics/config.ts");
  assert.match(config, /isMarketingAnalyticsEnabled\(\)/);
});

test("sentry production traces sample rate stays 0.02", () => {
  const source = readRepo("lib/sentry/shared.ts");
  assert.match(source, /if \(env === "preview" \|\| env === "staging"\) return 0\.01;/);
  assert.match(source, /return 0\.02;/);
});

test("sentry ignores iOS WebKit fetch Load failed noise", () => {
  const source = readRepo("lib/sentry/shared.ts");
  assert.match(source, /ignoreErrors/);
  assert.match(source, /"Load failed"/);
  assert.match(source, /"Failed to fetch"/);
  assert.match(source, /"Network request failed"/);
});

test("PWA service worker does not proxy fetches through respondWith", () => {
  const source = readRepo("public/sw.js");
  assert.match(source, /addEventListener\("fetch"/);
  assert.doesNotMatch(source, /event\.respondWith\(/);
});

test("admin bookings client catches fetch failures on cancel and reload", () => {
  const source = readRepo("app/admin/bookings/BookingsClient.tsx");
  assert.match(source, /async function loadData\(\)/);
  assert.match(source, /async function cancelBooking/);
  assert.match(source, /fetch\("\/api\/bookings\/list"\)/);
  assert.match(source, /fetch\("\/api\/bookings\/cancel"/);
  assert.match(source, /} catch \{/);
  assert.match(source, /} finally \{[\s\S]*setLoading\(false\)/);
  assert.match(source, /} finally \{[\s\S]*setCancellingId\(null\)/);
});

test("iOS TypeError Load failed from Promise.all fetch is catchable", async () => {
  const result = await (async () => {
    try {
      await Promise.all([
        Promise.reject(new TypeError("Load failed")),
        Promise.resolve({ ok: true }),
      ]);
      return "threw-nothing";
    } catch (error) {
      assert.equal(error instanceof TypeError, true);
      assert.equal(error.message, "Load failed");
      return "kept-list";
    }
  })();
  assert.equal(result, "kept-list");
});

test("campaign progress polling stops on terminal status and hidden tabs", () => {
  const source = readRepo(
    "app/email/(console)/campaigns/[id]/CampaignEditor.tsx",
  );
  assert.match(source, /campaignStatus === "sending"/);
  assert.match(source, /document\.hidden/);
  assert.match(source, /visibilitychange/);
  assert.doesNotMatch(
    source,
    /if \(campaignStatus === "draft"\) return;/,
  );
});

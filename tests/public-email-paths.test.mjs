import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function isSecretAuthenticatedApiPath(pathname) {
  return (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/internal/") ||
    pathname.startsWith("/api/webhooks/")
  );
}

function isPublicEmailPath(pathname) {
  if (pathname.startsWith("/unsubscribe")) return true;
  if (pathname.startsWith("/email/unsubscribe")) return true;
  if (pathname.startsWith("/api/email/sso")) return true;
  if (pathname.startsWith("/api/email/unsubscribe")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/email")) {
    return true;
  }
  return false;
}

test("secret-authenticated cron and worker APIs skip cookie auth", () => {
  assert.equal(isSecretAuthenticatedApiPath("/api/cron/notion-sync"), true);
  assert.equal(isSecretAuthenticatedApiPath("/api/cron/reminder"), true);
  assert.equal(
    isSecretAuthenticatedApiPath("/api/internal/marketing/automations"),
    true,
  );
  assert.equal(
    isSecretAuthenticatedApiPath("/api/internal/marketing/worker"),
    true,
  );
  assert.equal(
    isSecretAuthenticatedApiPath("/api/webhooks/resend/marketing"),
    true,
  );
  assert.equal(isSecretAuthenticatedApiPath("/api/email/campaigns"), false);
  assert.equal(isSecretAuthenticatedApiPath("/contacts"), false);
});

test("email host does not redirect cron or marketing workers to login", () => {
  assert.equal(isPublicEmailPath("/api/internal/marketing/automations"), true);
  assert.equal(isPublicEmailPath("/api/internal/marketing/worker"), true);
  assert.equal(isPublicEmailPath("/api/cron/notion-sync"), true);
  assert.equal(isPublicEmailPath("/api/cron/reminder"), true);
  assert.equal(isPublicEmailPath("/api/bookings/create"), true);
  assert.equal(isPublicEmailPath("/api/email/sso"), true);
  assert.equal(isPublicEmailPath("/api/email/unsubscribe"), true);
  assert.equal(isPublicEmailPath("/unsubscribe"), true);

  assert.equal(isPublicEmailPath("/contacts"), false);
  assert.equal(isPublicEmailPath("/automations"), false);
  assert.equal(isPublicEmailPath("/api/email/campaigns"), false);
  assert.equal(isPublicEmailPath("/api/email/automations"), false);
});

test("proxy wires secret-auth bypass and matcher exclusions", () => {
  const helper = readFileSync(
    new URL("../lib/frizeo-email/publicEmailPaths.ts", import.meta.url),
    "utf8",
  );
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

  assert.match(helper, /export function isPublicEmailPath/);
  assert.match(helper, /export function isSecretAuthenticatedApiPath/);
  assert.match(helper, /pathname\.startsWith\("\/api\/cron"\)/);
  assert.match(helper, /pathname\.startsWith\("\/api\/internal\/"\)/);
  assert.match(
    helper,
    /pathname\.startsWith\("\/api\/"\) && !pathname\.startsWith\("\/api\/email"\)/,
  );

  assert.match(proxy, /from "@\/lib\/frizeo-email\/publicEmailPaths"/);
  assert.match(proxy, /isSecretAuthenticatedApiPath\(pathname\)/);
  assert.match(proxy, /!isPublicEmailPath\(pathname\)/);
  assert.match(proxy, /api\/cron\|api\/internal\|api\/webhooks/);
});

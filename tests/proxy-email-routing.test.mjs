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

function emailHostPathAction(pathname) {
  if (pathname === "/email" || pathname.startsWith("/email/")) {
    const stripped = pathname.slice("/email".length) || "/";
    return { action: "redirect", pathname: stripped };
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return { action: "passthrough" };
  }

  return {
    action: "rewrite",
    pathname: pathname === "/" ? "/email" : `/email${pathname}`,
  };
}

function needsSessionLookup(pathname, onEmailHost) {
  if (isSecretAuthenticatedApiPath(pathname)) {
    return false;
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return true;
  }

  const onEmailApp =
    onEmailHost ||
    pathname === "/email" ||
    pathname.startsWith("/email/") ||
    pathname.startsWith("/api/email");

  return onEmailApp && !isPublicEmailPath(pathname);
}

test("email host rewrites console paths and canonicalizes /email/*", () => {
  assert.deepEqual(emailHostPathAction("/"), {
    action: "rewrite",
    pathname: "/email",
  });
  assert.deepEqual(emailHostPathAction("/contacts"), {
    action: "rewrite",
    pathname: "/email/contacts",
  });
  assert.deepEqual(emailHostPathAction("/campaigns/abc"), {
    action: "rewrite",
    pathname: "/email/campaigns/abc",
  });
  assert.deepEqual(emailHostPathAction("/unsubscribe/tok"), {
    action: "rewrite",
    pathname: "/email/unsubscribe/tok",
  });
  assert.deepEqual(emailHostPathAction("/email"), {
    action: "redirect",
    pathname: "/",
  });
  assert.deepEqual(emailHostPathAction("/email/contacts"), {
    action: "redirect",
    pathname: "/contacts",
  });
  assert.deepEqual(emailHostPathAction("/api/email/sso"), {
    action: "passthrough",
  });
  assert.deepEqual(emailHostPathAction("/robots.txt"), {
    action: "passthrough",
  });
});

test("session lookup stays on admin and gated email, not public surfaces", () => {
  assert.equal(needsSessionLookup("/admin", false), true);
  assert.equal(needsSessionLookup("/admin/dashboard", false), true);
  assert.equal(needsSessionLookup("/email", false), true);
  assert.equal(needsSessionLookup("/email/contacts", false), true);
  assert.equal(needsSessionLookup("/api/email/campaigns", false), true);
  assert.equal(needsSessionLookup("/contacts", true), true);

  assert.equal(needsSessionLookup("/email/unsubscribe/tok", false), false);
  assert.equal(needsSessionLookup("/unsubscribe/tok", true), false);
  assert.equal(needsSessionLookup("/api/email/sso", true), false);
  assert.equal(
    needsSessionLookup("/api/internal/marketing/automations", true),
    false,
  );
  assert.equal(needsSessionLookup("/api/cron/reminder", true), false);

  assert.equal(needsSessionLookup("/", false), false);
  assert.equal(needsSessionLookup("/booking/salon/demo", false), false);
  assert.equal(needsSessionLookup("/api/slots", false), false);
  assert.equal(needsSessionLookup("/api/availability", false), false);
  assert.equal(needsSessionLookup("/icon", false), false);
  assert.equal(needsSessionLookup("/sitemap.xml", false), false);
  assert.equal(needsSessionLookup("/robots.txt", false), false);
  assert.equal(needsSessionLookup("/login", false), false);
});

test("proxy matcher is host-scoped instead of a global catch-all", () => {
  const source = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.match(source, /value: "email\.frizeo\.ro"/);
  assert.match(source, /value: "email\.localhost"/);
  assert.match(source, /value: "email\.local"/);
  assert.match(source, /"\/admin"/);
  assert.match(source, /"\/email"/);
  assert.match(source, /"\/api\/email\/:path\*"/);
  assert.equal(
    (source.match(/type: "host"/g) || []).length,
    3,
    "every catch-all matcher must be host-scoped",
  );
  assert.doesNotMatch(
    source,
    /(?:matcher:\s*\[|,)\s*"\/\(\(\?!_next\/static/,
    "must not keep a host-agnostic string catch-all",
  );
});

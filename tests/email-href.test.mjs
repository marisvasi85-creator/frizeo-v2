import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const EMAIL_APP_PREFIX = "/email";

function isEmailHost(hostname) {
  if (!hostname) return false;
  const host = String(hostname).split(":")[0]?.toLowerCase() ?? "";
  return (
    host === "email.frizeo.ro" ||
    host === "email.localhost" ||
    host === "email.local"
  );
}

function shouldUseBareEmailPaths(host) {
  if (host != null && host !== "") return isEmailHost(host);
  return false;
}

/** Mirrors app/email/(console)/components/emailNav.ts emailHref */
function emailHref(path, opts = {}) {
  const raw = path.trim();
  const qIndex = raw.indexOf("?");
  const pathnamePart = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex + 1) : "";

  const normalized =
    pathnamePart === "" || pathnamePart === "/"
      ? ""
      : pathnamePart.startsWith("/")
        ? pathnamePart
        : `/${pathnamePart}`;

  const bare = opts.bare ?? shouldUseBareEmailPaths(opts.host ?? null);
  const href = bare
    ? normalized || "/"
    : `${EMAIL_APP_PREFIX}${normalized}` || EMAIL_APP_PREFIX;

  return query ? `${href}?${query}` : href;
}

test("email host uses bare console paths", () => {
  assert.equal(emailHref("/contacts", { bare: true }), "/contacts");
  assert.equal(emailHref("/contacts", { bare: false }), "/email/contacts");
  assert.equal(emailHref("", { bare: true }), "/");
  assert.equal(emailHref("", { bare: false }), "/email");
  assert.equal(
    emailHref("/contacts?status=subscribed", { host: "email.frizeo.ro" }),
    "/contacts?status=subscribed",
  );
  assert.equal(
    emailHref("/campaigns/abc", { host: "www.frizeo.ro" }),
    "/email/campaigns/abc",
  );
});

test("email console no longer hardcodes /email page navigations", () => {
  const files = [
    "app/email/(console)/contacts/ContactsClient.tsx",
    "app/email/(console)/campaigns/CampaignsClient.tsx",
    "app/email/(console)/segments/SegmentsClient.tsx",
    "app/email/(console)/automations/AutomationsClient.tsx",
    "app/email/(console)/campaigns/templates/TemplatesClient.tsx",
    "app/email/(console)/campaigns/[id]/CampaignEditor.tsx",
    "app/email/(console)/components/EmailMobileNav.tsx",
    "app/email/(console)/components/EmailSidebar.tsx",
  ];

  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /useEmailHref/, `${file} should use useEmailHref`);
    assert.doesNotMatch(
      source,
      /router\.push\(`\/email\//,
      `${file} should not router.push /email/... pages`,
    );
    assert.doesNotMatch(
      source,
      /href="\/email\//,
      `${file} should not hardcode href="/email/..."`,
    );
  }
});

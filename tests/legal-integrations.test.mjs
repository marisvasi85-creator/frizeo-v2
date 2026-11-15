import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dispositionFor } from "../lib/account-deletion/policy.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("privacy policy describes the integration data that the code actually uses", () => {
  const privacy = readRepo("app/privacy/page.tsx");
  assert.match(privacy, /business\.manage/);
  assert.match(privacy, /pages_manage_posts/);
  assert.match(privacy, /instagram_content_publish/);
  assert.match(privacy, /user\.info\.basic/);
  assert.match(privacy, /video\.upload/);
  assert.match(privacy, /video\.publish/);
  assert.match(privacy, /art\. 6 alin\. \(1\) lit\. b/);
  assert.match(privacy, /Spațiului Economic European/);
  assert.match(privacy, /\/stergere-date/);
  assert.doesNotMatch(privacy, /Nu solicităm alte permisiuni Google/);
  assert.doesNotMatch(privacy, /callback de ștergere/);
});

test("terms, cookies, and the public deletion page stay consistent", () => {
  const terms = readRepo("app/terms/page.tsx");
  const cookies = readRepo("app/cookies/page.tsx");
  const deletion = readRepo("app/stergere-date/page.tsx");
  const calendar = readRepo("app/google-calendar-data/page.tsx");
  assert.match(terms, /2\.2 Facebook, Instagram, TikTok și Google Business Profile/);
  assert.match(terms, /href="\/stergere-date"/);
  assert.match(cookies, /Meta Pixel și TikTok Pixel/);
  assert.match(cookies, /href="\/stergere-date"/);
  assert.match(deletion, /nu au o perioadă automată de ștergere/);
  assert.match(deletion, /English summary for platform reviewers/);
  assert.doesNotMatch(deletion, /redirect\("\/login"\)/);
  assert.match(calendar, /business\.manage/);
  assert.match(calendar, /separate, optional Google Business Profile connection/);
});

test("legal pages are public and linked without an admin gate", () => {
  const sitemap = readRepo("app/sitemap.ts");
  const robots = readRepo("app/robots.ts");
  const footer = readRepo("app/components/Footer.tsx");
  const proxy = readRepo("proxy.ts");
  for (const path of ["/privacy", "/terms", "/cookies", "/stergere-date", "/google-calendar-data"]) {
    assert.match(sitemap, new RegExp(path.replaceAll("/", "\\/")));
    assert.match(footer, new RegExp(`href="${path}"`));
    assert.doesNotMatch(robots, new RegExp(`"${path}"`));
  }
  assert.match(proxy, /pathname === "\/admin" \|\| pathname\.startsWith\("\/admin\/"\)/);
  assert.doesNotMatch(proxy, /\/privacy|\/stergere-date|\/terms|\/cookies/);
});

test("account deletion does not claim to remove salon integrations", () => {
  assert.equal(dispositionFor("marketing_connections"), "KEEP");
  assert.equal(dispositionFor("storage:marketing-publish"), "KEEP");
  assert.equal(dispositionFor("barber_google_accounts"), "DELETE");
  const doc = readRepo("docs/ACCOUNT_DELETION.md");
  assert.match(doc, /Nu deconectăm Meta, TikTok sau Google Business Profile/);
});

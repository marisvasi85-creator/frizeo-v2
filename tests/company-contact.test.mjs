import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  LEGAL_COMPANY,
  companyTelHref,
  companyWhatsAppUrl,
} from "../lib/legal/company.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("Frizeo company phone is 0753 332 181 with WhatsApp Business", () => {
  assert.equal(LEGAL_COMPANY.phone, "0753 332 181");
  assert.equal(LEGAL_COMPANY.phoneE164, "+40753332181");
  assert.equal(companyTelHref(), "tel:+40753332181");
  assert.equal(companyWhatsAppUrl(), "https://wa.me/40753332181");
});

test("public contact surfaces use the company phone helpers", () => {
  const files = [
    "app/components/Footer.tsx",
    "app/components/BookingFooter.tsx",
    "app/(marketing)/contact/page.tsx",
    "app/(marketing)/pricing/page.tsx",
    "lib/site/jsonLd.ts",
    "lib/site/faqContent.ts",
    "app/privacy/page.tsx",
    "app/terms/page.tsx",
    "app/cookies/page.tsx",
    "app/google-calendar-data/page.tsx",
    "app/admin/billing/BillingPlansSection.tsx",
    "lib/assistant/knowledge/articles.ts",
  ];

  for (const file of files) {
    const source = readRepo(file);
    assert.match(
      source,
      /LEGAL_COMPANY\.phone|LEGAL_COMPANY\.phoneE164|companyTelHref|companyWhatsAppUrl|\bc\.phone(?:E164)?\b/,
      `${file} should use the Frizeo company phone`,
    );
  }
});

test("llms.txt and support docs publish the Frizeo phone", () => {
  for (const file of [
    "public/llms.txt",
    "docs/SETUP_COMPLET.md",
    "docs/BETA.md",
    "lib/email/templates/account-deletion.ts",
  ]) {
    const source = readRepo(file);
    assert.match(source, /0753 332 181/);
    assert.match(source, /WhatsApp Business/);
  }
});

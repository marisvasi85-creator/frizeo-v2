#!/usr/bin/env node
/**
 * Afișează lista de Gmail-uri de adăugat ca Test users în Google Cloud Console.
 * Rulează: node scripts/print-google-test-users.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const listPath = join(root, "..", "config", "google-test-users.txt");

const raw = readFileSync(listPath, "utf8");
const emails = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

if (emails.length === 0) {
  console.log("Niciun email în config/google-test-users.txt");
  console.log("Adaugă câte un Gmail pe linie (fără #).");
  process.exit(1);
}

console.log("=== Google OAuth — Test users de adăugat manual ===\n");
console.log("Google Cloud Console → APIs & Services → OAuth consent screen → Test users\n");
emails.forEach((email, i) => {
  console.log(`  ${i + 1}. ${email}`);
});
console.log("\nRedirect URI necesar în Credentials → OAuth client:");
console.log("  https://www.frizeo.ro/api/google/callback");
console.log("\n(+ URL-ul de preview Vercel dacă testezi pe branch)\n");

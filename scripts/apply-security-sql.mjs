#!/usr/bin/env node
/**
 * Applies supabase/APPLY_NOW_SECURITY.sql when DATABASE_URL or SUPABASE_DB_URL is set.
 *
 * Usage:
 *   DATABASE_URL='postgresql://…' node scripts/apply-security-sql.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dbUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";

if (!dbUrl) {
  console.error(
    "Lipseste DATABASE_URL / SUPABASE_DB_URL.\n" +
      "Variante:\n" +
      "1) Seteaza connection string-ul (Supabase → Project Settings → Database)\n" +
      "2) Sau lipeste supabase/APPLY_NOW_SECURITY.sql in Supabase SQL Editor\n" +
      "3) Sau autentifica MCP Supabase in Cursor Desktop pentru acest agent",
  );
  process.exit(1);
}

const sqlPath = resolve("supabase/APPLY_NOW_SECURITY.sql");
const sql = readFileSync(sqlPath, "utf8");

const psql = spawnSync(
  "psql",
  [dbUrl, "-v", "ON_ERROR_STOP=1", "-c", sql],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);

if (psql.stdout) process.stdout.write(psql.stdout);
if (psql.stderr) process.stderr.write(psql.stderr);

if (psql.status !== 0) {
  console.error("Aplicarea SQL a esuat.");
  process.exit(psql.status ?? 1);
}

console.log("OK — APPLY_NOW_SECURITY.sql aplicat.");

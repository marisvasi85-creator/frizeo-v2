import { readFile, writeFile } from "node:fs/promises";

const [metadataPath, outputPath] = process.argv.slice(2);

if (!metadataPath || !outputPath) {
  throw new Error(
    "Usage: node scripts/generate-supabase-baseline.mjs <metadata.json> <output.sql>",
  );
}

const schema = JSON.parse(await readFile(metadataPath, "utf8"));
const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;
const qualifiedTable = (name) => `public.${quoteIdentifier(name)}`;
const statements = [
  "-- Generated from read-only PostgreSQL catalog metadata.",
  "-- Contains schema only: no production customer or authentication data.",
  "begin;",
  "create extension if not exists pgcrypto;",
];

for (const table of schema.tables) {
  const columns = table.columns.map((column) => {
    const parts = [quoteIdentifier(column.name), column.type];
    if (column.default !== null) parts.push(`default ${column.default}`);
    if (column.not_null) parts.push("not null");
    return `  ${parts.join(" ")}`;
  });

  statements.push(
    `create table ${qualifiedTable(table.name)} (\n${columns.join(",\n")}\n);`,
  );
}

const constraints = [...schema.constraints].sort((a, b) => {
  const priority = (constraint) =>
    /^(PRIMARY KEY|UNIQUE)/.test(constraint.definition) ? 0 : 1;
  return priority(a) - priority(b);
});
for (const constraint of constraints) {
  statements.push(
    `alter table ${qualifiedTable(constraint.table)} add constraint ${quoteIdentifier(constraint.name)} ${constraint.definition};`,
  );
}

const constraintNames = new Set(schema.constraints.map(({ name }) => name));
for (const index of schema.indexes) {
  if (!constraintNames.has(index.name)) statements.push(`${index.definition};`);
}

const functionOrder = new Map([
  ["get_current_tenant_id", 0],
  ["get_current_role", 1],
  ["get_current_barber_id", 2],
  ["set_updated_at", 3],
  ["prevent_booking_overlap", 4],
]);
const functions = [...schema.functions].sort(
  (a, b) =>
    (functionOrder.get(a.name) ?? 10) - (functionOrder.get(b.name) ?? 10),
);
for (const fn of functions) statements.push(`${fn.definition.trim()};`);

for (const view of schema.views) {
  statements.push(
    `create view public.${quoteIdentifier(view.name)} with (security_invoker = true) as\n${view.definition.trim()}`,
  );
}

for (const trigger of schema.triggers) {
  statements.push(`${trigger.definition};`);
}

for (const table of schema.tables) {
  if (table.rls) {
    statements.push(`alter table ${qualifiedTable(table.name)} enable row level security;`);
  }
}

for (const policy of schema.policies) {
  const roles = policy.roles
    .map((role) => (role === "public" ? "public" : quoteIdentifier(role)))
    .join(", ");
  const clauses = [
    `create policy ${quoteIdentifier(policy.policyname)} on ${qualifiedTable(policy.tablename)}`,
    `as ${policy.permissive.toLowerCase()} for ${policy.cmd.toLowerCase()} to ${roles}`,
  ];
  if (policy.qual) clauses.push(`using (${policy.qual})`);
  if (policy.with_check) clauses.push(`with check (${policy.with_check})`);
  statements.push(`${clauses.join("\n")};`);
}

for (const bucket of schema.buckets) {
  const allowedMimeTypes = bucket.allowed_mime_types
    ? `array[${bucket.allowed_mime_types.map((item) => `'${item.replaceAll("'", "''")}'`).join(", ")}]::text[]`
    : "null";
  statements.push(
    `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (` +
      `'${bucket.id.replaceAll("'", "''")}', '${bucket.name.replaceAll("'", "''")}', ` +
      `${bucket.public}, ${bucket.file_size_limit ?? "null"}, ${allowedMimeTypes}) ` +
      `on conflict (id) do update set name = excluded.name, public = excluded.public, ` +
      `file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;`,
  );
}

statements.push(
  "grant usage on schema public to anon, authenticated, service_role;",
  "grant select on all tables in schema public to anon;",
  "grant select, insert, update, delete on all tables in schema public to authenticated;",
  "grant all on all tables in schema public to service_role;",
  "grant execute on all functions in schema public to authenticated, service_role;",
  "commit;",
  "",
);

await writeFile(outputPath, statements.join("\n\n"));

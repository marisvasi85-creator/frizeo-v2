#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Local-only database bootstrap for Frizeo.
#
# The repo's supabase/migrations are incremental and several share the same
# date-only version prefix (e.g. two 20260710_*.sql), which the Supabase CLI
# migration runner (`supabase db reset`) cannot track (duplicate version key).
# This script instead applies the schema directly with psql, in filename order,
# starting from the reconstructed base schema.
#
# Requires: local Supabase running (`supabase start`) so the db container exists.
# Usage: bash scripts/db-local-setup.sh
# WARNING: this DROPS and recreates the public schema (local dev data is lost).
# -----------------------------------------------------------------------------
set -euo pipefail

DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_workspace}"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"

run_sql() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

echo ">> Resetting public schema..."
run_sql <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
SQL

# Apply in filename order, but push any *backfill* migration to the end of its
# same-date group (a backfill depends on the schema created that same date, and
# these files share a date-only version prefix so plain sort can misorder them).
ordered=$(
  for f in "$MIGRATIONS_DIR"/*.sql; do
    base=$(basename "$f")
    case "$base" in
      *backfill*) printf '%s\t%s\n' "${base%%_*}~${base}" "$f" ;;
      *)          printf '%s\t%s\n' "${base%%_*} ${base}" "$f" ;;
    esac
  done | LC_ALL=C sort | cut -f2-
)

while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo ">> Applying $(basename "$f")"
  run_sql < "$f"
done <<< "$ordered"

echo ">> Granting privileges on newly created objects to API roles..."
run_sql <<'SQL'
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
SQL

echo ">> Done. Schema applied."

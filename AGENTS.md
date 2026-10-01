# AGENTS.md

Frizeo — a Next.js 16 (App Router) + Supabase SaaS for barbershop booking, admin, public salon directory, billing and AI marketing. Single app; all API routes live under `app/api/*`. There is no separate backend service.

Standard commands are defined in `package.json` (`dev`, `build`, `start`, `lint`) and `README.md`. There are no automated tests in this repo.

## Cursor Cloud specific instructions

The app requires a Postgres/Supabase backend. Production runs against a hosted Supabase project, but that project's **base schema was never committed** — `supabase/migrations/` are incremental `ALTER`s on top of tables that were created manually in the dashboard. For a self-contained local dev environment we run a **local Supabase stack (Docker)** and recreate the missing base schema.

### One-time (already baked into the VM snapshot)
- Docker CE is installed and configured with `fuse-overlayfs` storage driver + `iptables-legacy` (required in this VM).
- The Supabase CLI is installed (`supabase --version`).
- `npm install` is handled by the startup update script.

### Bringing the environment up each session
Run these (they are startup/service steps, intentionally NOT in the update script):

1. Start the Docker daemon (needs sudo; leave it running):
   `sudo dockerd &`  (then `sudo chmod 666 /var/run/docker.sock` so `docker`/`supabase` work without sudo)
2. Start local Supabase (from repo root): `supabase start`
   - API: `http://127.0.0.1:54321`, Studio: `http://127.0.0.1:54323`, DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
3. Load the schema: `bash scripts/db-local-setup.sh`
   - This DROPs/recreates the `public` schema and applies `supabase/migrations/*.sql` in order via `psql` inside the `supabase_db_workspace` container. We bypass `supabase db reset` on purpose: several migrations share a date-only version prefix (e.g. two `20260710_*`), which breaks the CLI's migration tracking (`schema_migrations_pkey` duplicate). The script also reorders `*backfill*` migrations after their same-date schema migrations.
4. Ensure `.env.local` exists (gitignored). Local Supabase uses fixed demo keys, so these values are stable:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key printed by `supabase start` / `supabase status`>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key printed by `supabase start` / `supabase status`>
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   TRIAL_DAYS=60
   ```
5. Run the app: `npm run dev` → `http://localhost:3000`.

### Schema notes / gotchas
- `supabase/migrations/00000000000000_base_schema.sql` is the reconstructed base (tables, `barbers_public` view, `get_current_tenant_id()`/`get_current_role()` helper functions used by RLS, and the `plans` seed). It is idempotent (`CREATE ... IF NOT EXISTS`, helper functions only created if absent, `ON CONFLICT DO NOTHING`), so it is harmless against an already-populated database.
- Writes on public booking + signup go through the **service-role** admin client (`lib/supabase/admin.ts`), which bypasses RLS. Admin dashboard reads use the user session client, so RLS policies from the migrations apply.
- Storage buckets (`salon-gallery`, `barber-avatars`) are not created by the schema; create them in Studio only if testing gallery/avatar upload.

### Optional integrations (all off by default, app runs without them)
Google OAuth/Calendar, SMTP email, SMSO SMS, Stripe billing, OpenAI/Gemini AI, FGO invoicing, external cron. Missing keys are handled gracefully (emails/SMS silently skip, Marketing AI falls back to templates). See `.env.example`.

### Quick end-to-end sanity check
Signup (creates tenant + barber + default services + weekly schedule + trial subscription):
`curl -X POST localhost:3000/api/auth/signup -H 'Content-Type: application/json' -d '{"email":"owner@frizeo.test","password":"Test1234!","fullName":"Radu Popescu","phone":"0722123456","acceptedTerms":true}'`
Public booking pages: `/booking/salon/<tenant-slug>` and `/booking/salon/<tenant-slug>/<barber-slug>`.

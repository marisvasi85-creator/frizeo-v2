-- =============================================================================
-- Frizeo — reconstructed BASE schema (LOCAL / fresh-database bootstrap)
-- -----------------------------------------------------------------------------
-- The repository's other migrations are INCREMENTAL: they ALTER a base schema
-- that was originally created directly in the hosted Supabase project and was
-- never checked into this repo. Without those base tables a fresh local
-- Supabase (supabase start / supabase db reset) cannot apply the incremental
-- migrations or run the app.
--
-- This file recreates that missing base so the app runs against a fresh
-- Postgres. It is written to be safe and idempotent:
--   * CREATE TABLE IF NOT EXISTS  -> no-op if the table already exists
--   * helper functions are only created when absent (never overwrite prod)
--   * plan seeds use ON CONFLICT DO NOTHING
-- RLS + policies are intentionally left to the incremental migrations.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- profiles (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  phone      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- tenants (a salon)
CREATE TABLE IF NOT EXISTS public.tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  slug        text,
  phone       text,
  description text,
  address     text,
  logo_url    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- tenant_users (membership + role)
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

-- user_active_tenant (currently selected tenant per user)
CREATE TABLE IF NOT EXISTS public.user_active_tenant (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- barbers
CREATE TABLE IF NOT EXISTS public.barbers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id                 uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name              text,
  phone                     text,
  slug                      text,
  active                    boolean NOT NULL DEFAULT true,
  avatar_url                text,
  bio                       text,
  instagram_url             text,
  google_calendar_connected boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- barber_services
CREATE TABLE IF NOT EXISTS public.barber_services (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id    uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         text,
  display_name text,
  duration     integer NOT NULL DEFAULT 30,
  price        numeric,
  active       boolean NOT NULL DEFAULT true,
  featured     boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,
  show_price   boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- barber_weekly_schedule (recurring weekly working hours; day_of_week 1=Mon..7=Sun)
CREATE TABLE IF NOT EXISTS public.barber_weekly_schedule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id     uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day_of_week   integer NOT NULL,
  is_working    boolean NOT NULL DEFAULT true,
  work_start    time,
  work_end      time,
  break_enabled boolean NOT NULL DEFAULT false,
  break_start   time,
  break_end     time,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- barber_day_overrides (per-date exceptions)
CREATE TABLE IF NOT EXISTS public.barber_day_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id     uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date          date NOT NULL,
  is_closed     boolean NOT NULL DEFAULT false,
  break_enabled boolean NOT NULL DEFAULT false,
  break_start   time,
  break_end     time,
  slot_duration integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- bookings (status: pending | confirmed | cancelled)
CREATE TABLE IF NOT EXISTS public.bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  barber_id         uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  barber_service_id uuid REFERENCES public.barber_services(id) ON DELETE SET NULL,
  date              date NOT NULL,
  start_time        time NOT NULL,
  end_time          time,
  status            text NOT NULL DEFAULT 'pending',
  client_name       text,
  client_phone      text,
  client_email      text,
  expires_at        timestamptz,
  cancel_token      uuid,
  reschedule_token  uuid,
  review_token      uuid,
  google_event_id   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- booking_cancellations (referenced by RLS hardening migration; no direct code use)
CREATE TABLE IF NOT EXISTS public.booking_cancellations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- plans (billing tiers; slug must match lib/billing/plans.ts)
CREATE TABLE IF NOT EXISTS public.plans (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text,
  slug                   text UNIQUE,
  price                  numeric,
  max_barbers            integer,
  max_bookings_per_month integer,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- subscriptions (one per tenant)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id              uuid REFERENCES public.plans(id),
  status               text NOT NULL DEFAULT 'trialing',
  current_period_start timestamptz,
  current_period_end   timestamptz,
  trial_ends_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- notification_settings (one per tenant)
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  booking_email_enabled    boolean NOT NULL DEFAULT true,
  booking_sms_enabled      boolean NOT NULL DEFAULT false,
  reminder_email_enabled   boolean NOT NULL DEFAULT true,
  reminder_sms_enabled     boolean NOT NULL DEFAULT true,
  reschedule_email_enabled boolean NOT NULL DEFAULT true,
  reschedule_sms_enabled   boolean NOT NULL DEFAULT false,
  cancel_email_enabled     boolean NOT NULL DEFAULT true,
  cancel_sms_enabled       boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- barber_invitations
CREATE TABLE IF NOT EXISTS public.barber_invitations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name  text,
  email      text,
  phone      text,
  token      uuid NOT NULL DEFAULT gen_random_uuid(),
  accepted   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- barber_google_accounts (OAuth tokens per barber)
CREATE TABLE IF NOT EXISTS public.barber_google_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id     uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  google_email  text,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  calendar_id   text DEFAULT 'primary',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- salon_gallery
CREATE TABLE IF NOT EXISTS public.salon_gallery (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  image_url  text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- barbers_public (safe public view; the RLS-hardening migration recreates it)
CREATE OR REPLACE VIEW public.barbers_public AS
SELECT id, display_name, active, tenant_id, phone, slug, avatar_url, bio, instagram_url
FROM public.barbers
WHERE active = true;

-- Helper functions used by RLS policies. Created only when absent so an
-- accidental `supabase db push` never overwrites the real production versions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_current_tenant_id'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.get_current_tenant_id() RETURNS uuid
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $body$
        SELECT tenant_id FROM public.user_active_tenant WHERE user_id = auth.uid() LIMIT 1
      $body$;
    $fn$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_current_role'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.get_current_role() RETURNS text
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $body$
        SELECT tu.role
        FROM public.tenant_users tu
        JOIN public.user_active_tenant uat
          ON uat.tenant_id = tu.tenant_id AND uat.user_id = tu.user_id
        WHERE tu.user_id = auth.uid()
        LIMIT 1
      $body$;
    $fn$;
  END IF;
END $$;

-- Seed canonical plans (slugs must match lib/billing/plans.ts).
INSERT INTO public.plans (name, slug, price, max_barbers, max_bookings_per_month)
VALUES
  ('Free',   'free',     0,    1,    30),
  ('Pro',    'pro',      59,   1,    NULL),
  ('Pro+',   'pro-plus', 129,  3,    NULL),
  ('Custom', 'custom',   0,    NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

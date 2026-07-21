-- Performance indexes for hot auth, booking, and schedule paths.

-- Auth / RLS membership lookups (every admin request)
CREATE INDEX IF NOT EXISTS tenant_users_user_id_tenant_id_idx
  ON public.tenant_users (user_id, tenant_id);

CREATE INDEX IF NOT EXISTS tenant_users_user_id_role_idx
  ON public.tenant_users (user_id, role);

CREATE INDEX IF NOT EXISTS barbers_user_id_tenant_id_idx
  ON public.barbers (user_id, tenant_id);

CREATE INDEX IF NOT EXISTS barbers_tenant_id_active_display_name_idx
  ON public.barbers (tenant_id, active, display_name);

-- Public booking slug lookups
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_uidx
  ON public.tenants (slug)
  WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS barbers_tenant_id_slug_uidx
  ON public.barbers (tenant_id, slug)
  WHERE slug IS NOT NULL;

-- Bookings: slots, dashboard, admin lists, cron
CREATE INDEX IF NOT EXISTS bookings_barber_id_date_start_time_idx
  ON public.bookings (barber_id, date, start_time);

CREATE INDEX IF NOT EXISTS bookings_barber_id_date_status_idx
  ON public.bookings (barber_id, date, status);

CREATE INDEX IF NOT EXISTS bookings_tenant_id_date_start_time_idx
  ON public.bookings (tenant_id, date DESC, start_time DESC);

CREATE INDEX IF NOT EXISTS bookings_tenant_id_status_date_idx
  ON public.bookings (tenant_id, status, date);

CREATE INDEX IF NOT EXISTS bookings_pending_expires_at_idx
  ON public.bookings (expires_at)
  WHERE status = 'pending';

-- Schedule / availability
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS barber_day_overrides_barber_id_date_uidx
    ON public.barber_day_overrides (barber_id, date);
EXCEPTION
  WHEN unique_violation THEN
    CREATE INDEX IF NOT EXISTS barber_day_overrides_barber_id_date_idx
      ON public.barber_day_overrides (barber_id, date);
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS barber_weekly_schedule_barber_id_day_uidx
    ON public.barber_weekly_schedule (barber_id, day_of_week);
EXCEPTION
  WHEN unique_violation THEN
    CREATE INDEX IF NOT EXISTS barber_weekly_schedule_barber_id_day_idx
      ON public.barber_weekly_schedule (barber_id, day_of_week);
END $$;

CREATE INDEX IF NOT EXISTS barber_services_barber_id_active_sort_idx
  ON public.barber_services (barber_id, active, sort_order);

-- Billing / notifications / Google (single-row-per-entity lookups)
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_id_uidx
    ON public.subscriptions (tenant_id);
EXCEPTION
  WHEN unique_violation THEN
    CREATE INDEX IF NOT EXISTS subscriptions_tenant_id_idx
      ON public.subscriptions (tenant_id);
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS notification_settings_tenant_id_uidx
    ON public.notification_settings (tenant_id);
EXCEPTION
  WHEN unique_violation THEN
    CREATE INDEX IF NOT EXISTS notification_settings_tenant_id_idx
      ON public.notification_settings (tenant_id);
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS barber_google_accounts_barber_id_uidx
    ON public.barber_google_accounts (barber_id);
EXCEPTION
  WHEN unique_violation THEN
    CREATE INDEX IF NOT EXISTS barber_google_accounts_barber_id_idx
      ON public.barber_google_accounts (barber_id);
END $$;

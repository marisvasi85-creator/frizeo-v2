-- Generated from read-only PostgreSQL catalog metadata.

-- Contains schema only: no production customer or authentication data.

begin;

create extension if not exists pgcrypto;

create table public."barber_day_overrides" (
  "id" uuid default gen_random_uuid() not null,
  "barber_id" uuid not null,
  "date" date not null,
  "is_closed" boolean default false,
  "break_enabled" boolean,
  "break_start" time without time zone,
  "break_end" time without time zone,
  "tenant_id" uuid,
  "created_at" timestamp with time zone default now(),
  "slot_duration" integer,
  "work_start" time without time zone,
  "work_end" time without time zone,
  "vacation_period_id" uuid
);

create table public."barber_google_accounts" (
  "barber_id" uuid not null,
  "google_email" text,
  "access_token" text,
  "refresh_token" text,
  "calendar_id" text,
  "created_at" timestamp with time zone default now(),
  "expires_at" timestamp with time zone
);

create table public."barber_invitations" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "email" text not null,
  "full_name" text not null,
  "phone" text,
  "token" text not null,
  "accepted" boolean default false not null,
  "created_at" timestamp with time zone default now()
);

create table public."barber_services" (
  "id" uuid default gen_random_uuid() not null,
  "barber_id" uuid not null,
  "display_name" text,
  "price" numeric(10,2),
  "duration" integer,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "sort_order" integer default 0,
  "show_price" boolean default true,
  "featured" boolean default false,
  "tenant_id" uuid,
  "name" text not null
);

create table public."barber_settings" (
  "barber_id" uuid not null,
  "slot_duration" integer not null,
  "cancel_limit_hours" integer default 24 not null,
  "tenant_id" uuid,
  "break_between_enabled" boolean default false,
  "break_between_minutes" integer default 0
);

create table public."barber_weekly_schedule" (
  "id" uuid default gen_random_uuid() not null,
  "barber_id" uuid not null,
  "day_of_week" integer not null,
  "is_working" boolean default false not null,
  "work_start" time without time zone,
  "work_end" time without time zone,
  "break_enabled" boolean default false,
  "break_start" time without time zone,
  "break_end" time without time zone,
  "tenant_id" uuid
);

create table public."barbers" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "display_name" text not null,
  "active" boolean default true,
  "tenant_id" uuid not null,
  "phone" text,
  "slug" text,
  "google_calendar_connected" boolean default false,
  "google_calendar_id" text,
  "google_access_token" text,
  "google_refresh_token" text,
  "google_token_expires_at" timestamp with time zone,
  "avatar_url" text,
  "bio" text,
  "instagram_url" text,
  "use_salon_location" boolean default true not null,
  "location_address_line" text,
  "location_city" text,
  "location_county" text,
  "location_postal_code" text,
  "location_maps_url" text,
  "location_latitude" double precision,
  "location_longitude" double precision,
  "min_booking_notice_hours" integer default 2 not null,
  "facebook_url" text,
  "tiktok_url" text
);

create table public."booking_cancellations" (
  "id" uuid default gen_random_uuid() not null,
  "booking_id" uuid not null,
  "reason" text,
  "cancelled_at" timestamp with time zone default now(),
  "cancelled_by" text
);

create table public."bookings" (
  "id" uuid default gen_random_uuid() not null,
  "barber_id" uuid not null,
  "start_time" time without time zone not null,
  "end_time" time without time zone not null,
  "client_name" text,
  "client_phone" text,
  "client_email" text,
  "status" text default 'confirmed'::text not null,
  "cancel_token" uuid default gen_random_uuid() not null,
  "tenant_id" uuid,
  "created_at" timestamp with time zone default now(),
  "date" date default CURRENT_DATE not null,
  "rescheduled_from" uuid,
  "updated_at" timestamp with time zone default now(),
  "reschedule_token" uuid,
  "reschedule_token_expires_at" timestamp with time zone,
  "barber_service_id" uuid,
  "expires_at" timestamp with time zone,
  "service_id" uuid,
  "reminder_sent" boolean default false,
  "reminder_24h_sent" boolean default false,
  "reminder_2h_sent" boolean default false,
  "reschedule_count" integer default 0,
  "google_event_id" text,
  "client_notes" text
);

create table public."city_seo_pages" (
  "city_slug" text not null,
  "city_name" text not null,
  "intro" text not null,
  "source" text default 'template'::text not null,
  "generated_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."marketing_ai_generations" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "barber_id" uuid,
  "content_type" text not null,
  "provider" text not null,
  "usage_date" date not null,
  "created_at" timestamp with time zone default now() not null,
  "title" text,
  "content" text,
  "hashtags" jsonb default '[]'::jsonb not null,
  "call_to_action" text,
  "service_id" uuid,
  "counts_toward_limit" boolean default true not null
);

create table public."notification_settings" (
  "tenant_id" uuid not null,
  "booking_email_enabled" boolean default true,
  "booking_sms_enabled" boolean default true,
  "reminder_email_enabled" boolean default true,
  "reminder_sms_enabled" boolean default true,
  "reschedule_email_enabled" boolean default true,
  "reschedule_sms_enabled" boolean default true,
  "cancel_email_enabled" boolean default true,
  "cancel_sms_enabled" boolean default true,
  "created_at" timestamp with time zone default now()
);

create table public."plans" (
  "id" uuid default gen_random_uuid() not null,
  "name" text,
  "price" integer,
  "max_barbers" integer,
  "stripe_price_id" text,
  "max_bookings_per_month" integer,
  "currency" text default 'ron'::text,
  "slug" text
);

create table public."platform_tenant_notes" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "author_user_id" uuid not null,
  "author_email" text,
  "body" text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."profiles" (
  "id" uuid not null,
  "full_name" text,
  "phone" text,
  "created_at" timestamp with time zone default now()
);

create table public."salon_gallery" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "image_url" text not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp with time zone default now()
);

create table public."salon_reviews" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "booking_id" uuid,
  "rating" smallint not null,
  "author_name" text not null,
  "comment" text,
  "approved" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."slug_redirects" (
  "id" uuid default gen_random_uuid() not null,
  "entity_type" text not null,
  "entity_id" uuid not null,
  "old_slug" text not null,
  "tenant_id" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table public."sms_sends" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "booking_id" uuid,
  "barber_id" uuid,
  "sms_type" text not null,
  "phone" text not null,
  "ok" boolean not null,
  "provider" text default 'smso'::text not null,
  "provider_status" integer,
  "provider_response" jsonb,
  "usage_date" date not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."subscriptions" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid,
  "plan_id" uuid,
  "status" text default 'active'::text,
  "created_at" timestamp without time zone default now(),
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "current_period_start" timestamp without time zone default now(),
  "current_period_end" timestamp without time zone,
  "updated_at" timestamp without time zone default now(),
  "trial_ends_at" timestamp without time zone
);

create table public."tenant_fiscal_invoices" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "stripe_invoice_id" text not null,
  "amount_ron" numeric(12,2) not null,
  "status" text not null,
  "fgo_serie" text,
  "fgo_numar" text,
  "fgo_pdf_url" text,
  "error_message" text,
  "issued_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table public."tenant_users" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "user_id" uuid not null,
  "role" text not null,
  "created_at" timestamp with time zone default now()
);

create table public."tenants" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "created_at" timestamp with time zone default now(),
  "slug" text,
  "phone" text,
  "address" text,
  "logo_url" text,
  "description" text,
  "billing_type" text,
  "billing_name" text,
  "billing_cui" text,
  "billing_reg_com" text,
  "billing_address_line1" text,
  "billing_city" text,
  "billing_county" text,
  "billing_postal_code" text,
  "billing_country" text default 'RO'::text,
  "location_address_line" text,
  "location_city" text,
  "location_county" text,
  "location_postal_code" text,
  "location_maps_url" text,
  "location_latitude" double precision,
  "location_longitude" double precision,
  "directory_listed" boolean default true not null
);

create table public."user_active_tenant" (
  "user_id" uuid not null,
  "tenant_id" uuid not null,
  "updated_at" timestamp with time zone default now()
);

alter table public."barber_day_overrides" add constraint "barber_day_overrides_barber_id_date_key" UNIQUE (barber_id, date);

alter table public."barber_day_overrides" add constraint "barber_day_overrides_pkey" PRIMARY KEY (id);

alter table public."barber_google_accounts" add constraint "barber_google_accounts_pkey" PRIMARY KEY (barber_id);

alter table public."barber_invitations" add constraint "barber_invitations_pkey" PRIMARY KEY (id);

alter table public."barber_invitations" add constraint "barber_invitations_token_key" UNIQUE (token);

alter table public."barber_services" add constraint "barber_services_pkey" PRIMARY KEY (id);

alter table public."barber_settings" add constraint "barber_settings_pkey" PRIMARY KEY (barber_id);

alter table public."barber_weekly_schedule" add constraint "barber_weekly_schedule_barber_id_day_of_week_key" UNIQUE (barber_id, day_of_week);

alter table public."barber_weekly_schedule" add constraint "barber_weekly_schedule_pkey" PRIMARY KEY (id);

alter table public."barber_weekly_schedule" add constraint "barber_weekly_schedule_unique_day" UNIQUE (barber_id, day_of_week);

alter table public."barbers" add constraint "barbers_pkey" PRIMARY KEY (id);

alter table public."barbers" add constraint "barbers_slug_key" UNIQUE (slug);

alter table public."barbers" add constraint "unique_user_per_barber" UNIQUE (user_id);

alter table public."booking_cancellations" add constraint "booking_cancellations_pkey" PRIMARY KEY (id);

alter table public."bookings" add constraint "bookings_pkey" PRIMARY KEY (id);

alter table public."bookings" add constraint "bookings_reschedule_token_key" UNIQUE (reschedule_token);

alter table public."city_seo_pages" add constraint "city_seo_pages_pkey" PRIMARY KEY (city_slug);

alter table public."marketing_ai_generations" add constraint "marketing_ai_generations_pkey" PRIMARY KEY (id);

alter table public."notification_settings" add constraint "notification_settings_pkey" PRIMARY KEY (tenant_id);

alter table public."plans" add constraint "plans_pkey" PRIMARY KEY (id);

alter table public."plans" add constraint "plans_slug_key" UNIQUE (slug);

alter table public."plans" add constraint "unique_plan_name" UNIQUE (name);

alter table public."platform_tenant_notes" add constraint "platform_tenant_notes_pkey" PRIMARY KEY (id);

alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);

alter table public."salon_gallery" add constraint "salon_gallery_pkey" PRIMARY KEY (id);

alter table public."salon_reviews" add constraint "salon_reviews_pkey" PRIMARY KEY (id);

alter table public."slug_redirects" add constraint "slug_redirects_pkey" PRIMARY KEY (id);

alter table public."sms_sends" add constraint "sms_sends_pkey" PRIMARY KEY (id);

alter table public."subscriptions" add constraint "subscriptions_pkey" PRIMARY KEY (id);

alter table public."tenant_fiscal_invoices" add constraint "tenant_fiscal_invoices_pkey" PRIMARY KEY (id);

alter table public."tenant_fiscal_invoices" add constraint "tenant_fiscal_invoices_stripe_invoice_id_key" UNIQUE (stripe_invoice_id);

alter table public."tenant_users" add constraint "tenant_users_pkey" PRIMARY KEY (id);

alter table public."tenant_users" add constraint "tenant_users_tenant_id_user_id_key" UNIQUE (tenant_id, user_id);

alter table public."tenants" add constraint "tenants_pkey" PRIMARY KEY (id);

alter table public."user_active_tenant" add constraint "user_active_tenant_pkey" PRIMARY KEY (user_id);

alter table public."barber_day_overrides" add constraint "barber_day_overrides_barber_id_fkey" FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE;

alter table public."barber_day_overrides" add constraint "barber_day_overrides_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."barber_google_accounts" add constraint "barber_google_accounts_barber_id_fkey" FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE;

alter table public."barber_invitations" add constraint "barber_invitations_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."barber_services" add constraint "barber_services_barber_id_fkey" FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE;

alter table public."barber_services" add constraint "barber_services_tenant_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

alter table public."barber_services" add constraint "valid_duration" CHECK (duration = ANY (ARRAY[15, 30, 45, 60, 75, 90, 120]));

alter table public."barber_settings" add constraint "barber_settings_barber_id_fkey" FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE;

alter table public."barber_settings" add constraint "barber_settings_slot_duration_check" CHECK (slot_duration > 0);

alter table public."barber_settings" add constraint "barber_settings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."barber_weekly_schedule" add constraint "barber_weekly_schedule_barber_id_fkey" FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE;

alter table public."barber_weekly_schedule" add constraint "barber_weekly_schedule_day_of_week_check" CHECK (day_of_week >= 1 AND day_of_week <= 7);

alter table public."barber_weekly_schedule" add constraint "barber_weekly_schedule_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."barbers" add constraint "barbers_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."barbers" add constraint "barbers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."booking_cancellations" add constraint "booking_cancellations_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

alter table public."booking_cancellations" add constraint "booking_cancellations_cancelled_by_check" CHECK (cancelled_by = ANY (ARRAY['client'::text, 'barber'::text, 'manager'::text, 'owner'::text]));

alter table public."bookings" add constraint "bookings_barber_id_fkey" FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE;

alter table public."bookings" add constraint "bookings_barber_service_id_fkey" FOREIGN KEY (barber_service_id) REFERENCES barber_services(id);

alter table public."bookings" add constraint "bookings_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text, 'no_show'::text]));

alter table public."bookings" add constraint "bookings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."bookings" add constraint "fk_service" FOREIGN KEY (service_id) REFERENCES barber_services(id) ON DELETE SET NULL;

alter table public."marketing_ai_generations" add constraint "marketing_ai_generations_barber_id_fkey" FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE SET NULL;

alter table public."marketing_ai_generations" add constraint "marketing_ai_generations_service_id_fkey" FOREIGN KEY (service_id) REFERENCES barber_services(id) ON DELETE SET NULL;

alter table public."marketing_ai_generations" add constraint "marketing_ai_generations_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."notification_settings" add constraint "notification_settings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

alter table public."platform_tenant_notes" add constraint "platform_tenant_notes_body_check" CHECK (char_length(body) > 0 AND char_length(body) <= 4000);

alter table public."platform_tenant_notes" add constraint "platform_tenant_notes_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."salon_gallery" add constraint "salon_gallery_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."salon_reviews" add constraint "salon_reviews_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

alter table public."salon_reviews" add constraint "salon_reviews_rating_check" CHECK (rating >= 1 AND rating <= 5);

alter table public."salon_reviews" add constraint "salon_reviews_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."slug_redirects" add constraint "slug_redirects_barber_requires_tenant" CHECK (entity_type = 'tenant'::text AND tenant_id IS NULL OR entity_type = 'barber'::text AND tenant_id IS NOT NULL);

alter table public."slug_redirects" add constraint "slug_redirects_entity_type_check" CHECK (entity_type = ANY (ARRAY['tenant'::text, 'barber'::text]));

alter table public."slug_redirects" add constraint "slug_redirects_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."sms_sends" add constraint "sms_sends_barber_id_fkey" FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE SET NULL;

alter table public."sms_sends" add constraint "sms_sends_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

alter table public."sms_sends" add constraint "sms_sends_sms_type_check" CHECK (sms_type = ANY (ARRAY['booking'::text, 'reminder'::text, 'reschedule'::text, 'cancel'::text]));

alter table public."sms_sends" add constraint "sms_sends_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."subscriptions" add constraint "subscriptions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES plans(id);

alter table public."subscriptions" add constraint "subscriptions_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

alter table public."tenant_fiscal_invoices" add constraint "tenant_fiscal_invoices_status_check" CHECK (status = ANY (ARRAY['issued'::text, 'failed'::text]));

alter table public."tenant_fiscal_invoices" add constraint "tenant_fiscal_invoices_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."tenant_users" add constraint "tenant_users_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'manager'::text, 'barber'::text]));

alter table public."tenant_users" add constraint "tenant_users_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."tenant_users" add constraint "tenant_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."tenants" add constraint "tenants_billing_type_check" CHECK (billing_type IS NULL OR (billing_type = ANY (ARRAY['individual'::text, 'company'::text])));

alter table public."user_active_tenant" add constraint "user_active_tenant_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."user_active_tenant" add constraint "user_active_tenant_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX barber_day_overrides_barber_id_date_uidx ON public.barber_day_overrides USING btree (barber_id, date);

CREATE INDEX barber_day_overrides_vacation_period_id_idx ON public.barber_day_overrides USING btree (barber_id, vacation_period_id) WHERE (vacation_period_id IS NOT NULL);

CREATE UNIQUE INDEX barber_google_accounts_barber_id_uidx ON public.barber_google_accounts USING btree (barber_id);

CREATE INDEX barber_services_barber_id_active_sort_idx ON public.barber_services USING btree (barber_id, active, sort_order);

CREATE INDEX barber_services_barber_id_idx ON public.barber_services USING btree (barber_id);

CREATE INDEX barber_services_barber_id_idx1 ON public.barber_services USING btree (barber_id);

CREATE INDEX idx_barber_services_tenant ON public.barber_services USING btree (tenant_id);

CREATE UNIQUE INDEX barber_weekly_schedule_barber_id_day_uidx ON public.barber_weekly_schedule USING btree (barber_id, day_of_week);

CREATE INDEX barbers_tenant_id_active_display_name_idx ON public.barbers USING btree (tenant_id, active, display_name);

CREATE INDEX barbers_tenant_id_idx ON public.barbers USING btree (tenant_id);

CREATE INDEX barbers_tenant_id_idx1 ON public.barbers USING btree (tenant_id);

CREATE UNIQUE INDEX barbers_tenant_id_slug_uidx ON public.barbers USING btree (tenant_id, slug) WHERE (slug IS NOT NULL);

CREATE INDEX barbers_user_id_tenant_id_idx ON public.barbers USING btree (user_id, tenant_id);

CREATE INDEX bookings_barber_id_date_idx ON public.bookings USING btree (barber_id, date);

CREATE INDEX bookings_barber_id_date_idx1 ON public.bookings USING btree (barber_id, date);

CREATE INDEX bookings_barber_id_date_start_time_idx ON public.bookings USING btree (barber_id, date, start_time);

CREATE INDEX bookings_barber_id_date_status_idx ON public.bookings USING btree (barber_id, date, status);

CREATE INDEX bookings_pending_expires_at_idx ON public.bookings USING btree (expires_at) WHERE (status = 'pending'::text);

CREATE INDEX bookings_reschedule_token_idx ON public.bookings USING btree (reschedule_token);

CREATE INDEX bookings_tenant_id_date_idx ON public.bookings USING btree (tenant_id, date);

CREATE INDEX bookings_tenant_id_date_idx1 ON public.bookings USING btree (tenant_id, date);

CREATE INDEX bookings_tenant_id_date_start_time_idx ON public.bookings USING btree (tenant_id, date DESC, start_time DESC);

CREATE INDEX bookings_tenant_id_status_date_idx ON public.bookings USING btree (tenant_id, status, date);

CREATE UNIQUE INDEX bookings_unique_slot ON public.bookings USING btree (barber_id, date, start_time) WHERE (status <> 'cancelled'::text);

CREATE INDEX idx_bookings_active ON public.bookings USING btree (barber_id, date, start_time, end_time) WHERE (status = ANY (ARRAY['confirmed'::text, 'pending'::text]));

CREATE UNIQUE INDEX unique_booking_slot ON public.bookings USING btree (barber_id, date, start_time) WHERE (status <> 'cancelled'::text);

CREATE UNIQUE INDEX unique_booking_slot_active ON public.bookings USING btree (barber_id, date, start_time) WHERE (status = 'confirmed'::text);

CREATE INDEX marketing_ai_generations_tenant_created_idx ON public.marketing_ai_generations USING btree (tenant_id, created_at DESC);

CREATE INDEX marketing_ai_generations_tenant_date_counted_idx ON public.marketing_ai_generations USING btree (tenant_id, usage_date) WHERE (counts_toward_limit = true);

CREATE INDEX marketing_ai_generations_tenant_date_idx ON public.marketing_ai_generations USING btree (tenant_id, usage_date);

CREATE UNIQUE INDEX notification_settings_tenant_id_idx ON public.notification_settings USING btree (tenant_id);

CREATE UNIQUE INDEX notification_settings_tenant_id_uidx ON public.notification_settings USING btree (tenant_id);

CREATE INDEX platform_tenant_notes_tenant_created_idx ON public.platform_tenant_notes USING btree (tenant_id, created_at DESC);

CREATE UNIQUE INDEX salon_reviews_booking_id_uidx ON public.salon_reviews USING btree (booking_id) WHERE (booking_id IS NOT NULL);

CREATE INDEX salon_reviews_tenant_approved_idx ON public.salon_reviews USING btree (tenant_id, approved, created_at DESC);

CREATE UNIQUE INDEX slug_redirects_barber_old_slug_idx ON public.slug_redirects USING btree (tenant_id, old_slug) WHERE (entity_type = 'barber'::text);

CREATE INDEX slug_redirects_entity_idx ON public.slug_redirects USING btree (entity_type, entity_id);

CREATE UNIQUE INDEX slug_redirects_tenant_old_slug_idx ON public.slug_redirects USING btree (old_slug) WHERE (entity_type = 'tenant'::text);

CREATE INDEX sms_sends_tenant_date_idx ON public.sms_sends USING btree (tenant_id, usage_date DESC);

CREATE INDEX sms_sends_tenant_type_date_idx ON public.sms_sends USING btree (tenant_id, sms_type, usage_date DESC);

CREATE INDEX sms_sends_usage_date_idx ON public.sms_sends USING btree (usage_date DESC);

CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);

CREATE UNIQUE INDEX subscriptions_tenant_id_uidx ON public.subscriptions USING btree (tenant_id);

CREATE INDEX tenant_fiscal_invoices_tenant_id_idx ON public.tenant_fiscal_invoices USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_tenant_users_tenant ON public.tenant_users USING btree (tenant_id);

CREATE INDEX idx_tenant_users_user ON public.tenant_users USING btree (user_id);

CREATE INDEX tenant_users_user_id_role_idx ON public.tenant_users USING btree (user_id, role);

CREATE INDEX tenant_users_user_id_tenant_id_idx ON public.tenant_users USING btree (user_id, tenant_id);

CREATE UNIQUE INDEX tenants_slug_idx ON public.tenants USING btree (slug);

CREATE UNIQUE INDEX tenants_slug_uidx ON public.tenants USING btree (slug) WHERE (slug IS NOT NULL);

CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select tenant_id
  from public.user_active_tenant
  where user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.get_current_role()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select role
  from public.tenant_users
  where tenant_id = public.get_current_tenant_id()
  and user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.get_current_barber_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select id
  from public.barbers
  where user_id = auth.uid()
  and tenant_id = public.get_current_tenant_id()
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM bookings
    WHERE barber_id = NEW.barber_id
      AND date = NEW.date
      AND status IN ('pending', 'confirmed')
      AND id != NEW.rescheduled_from -- 🔥 CHEIA
      AND (
        NEW.start_time < end_time
        AND NEW.end_time > start_time
      )
  ) THEN
    RAISE EXCEPTION 'Slot ocupat';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_booking_safe(p_booking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update bookings
  set status = 'cancelled'
  where id = p_booking_id;

  insert into booking_cancellations (
    booking_id,
    cancelled_by,
    cancelled_at
  )
  values (
    p_booking_id,
    'client',
    now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_booking_safe(p_barber_id uuid, p_barber_service_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_client_name text, p_client_phone text, p_client_email text)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_booking bookings;
  v_tenant_id uuid;
BEGIN

  SELECT tenant_id
  INTO v_tenant_id
  FROM barbers
  WHERE id = p_barber_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Barber has no tenant';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM barber_services
    WHERE id = p_barber_service_id
      AND barber_id = p_barber_id
  ) THEN
    RAISE EXCEPTION 'Invalid barber service';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM bookings
    WHERE barber_id = p_barber_id
      AND date = p_date
      AND start_time = p_start
      AND end_time = p_end
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Slot already booked';
  END IF;

  INSERT INTO bookings (
    barber_id,
    tenant_id,
    barber_service_id,
    date,
    start_time,
    end_time,
    client_name,
    client_phone,
    client_email,
    status,
    cancel_token,
    reschedule_token,
    created_at
  )
  VALUES (
    p_barber_id,
    v_tenant_id,
    p_barber_service_id,
    p_date,
    p_start,
    p_end,
    p_client_name,
    p_client_phone,
    p_client_email,
    'confirmed',
    gen_random_uuid(),
    gen_random_uuid(),
    now()
  )
  RETURNING * INTO new_booking;

  RETURN new_booking;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_booking_safe(p_barber_id uuid, p_barber_service_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_client_name text, p_client_phone text, p_client_email text, p_reschedule_count integer DEFAULT 0, p_rescheduled_from uuid DEFAULT NULL::uuid)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_booking bookings;
  v_tenant_id uuid;
BEGIN

  SELECT tenant_id INTO v_tenant_id
  FROM barbers
  WHERE id = p_barber_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Barber has no tenant';
  END IF;

  -- 🔥 VALIDARE SERVICIU
  IF NOT EXISTS (
    SELECT 1
    FROM barber_services
    WHERE id = p_barber_service_id
      AND barber_id = p_barber_id
  ) THEN
    RAISE EXCEPTION 'Invalid barber service';
  END IF;

  -- 🔥 ANTI OVERLAP (FIX REAL)
  IF EXISTS (
    SELECT 1
    FROM bookings
    WHERE barber_id = p_barber_id
      AND date = p_date
      AND start_time < p_end
      AND end_time > p_start
      AND status != 'cancelled'
      AND (p_rescheduled_from IS NULL OR id != p_rescheduled_from)
  ) THEN
    RAISE EXCEPTION 'Slot already booked';
  END IF;

  -- 🔥 INSERT
  INSERT INTO bookings (
    barber_id,
    tenant_id,
    barber_service_id,
    date,
    start_time,
    end_time,
    client_name,
    client_phone,
    client_email,
    status,
    cancel_token,
    reschedule_token,
    reschedule_count,
    rescheduled_from,
    created_at
  )
  VALUES (
    p_barber_id,
    v_tenant_id,
    p_barber_service_id,
    p_date,
    p_start,
    p_end,
    p_client_name,
    p_client_phone,
    p_client_email,
    'confirmed',
    gen_random_uuid(),
    gen_random_uuid(),
    p_reschedule_count,
    p_rescheduled_from,
    now()
  )
  RETURNING * INTO new_booking;

  RETURN new_booking;

END;
$function$;

CREATE OR REPLACE FUNCTION public.create_booking_safe(p_barber_id uuid, p_barber_service_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_client_name text, p_client_phone text, p_client_email text, p_reschedule_count integer DEFAULT 0)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_booking bookings;
  v_tenant_id uuid;
BEGIN

  -- 🔥 tenant
  SELECT tenant_id
  INTO v_tenant_id
  FROM barbers
  WHERE id = p_barber_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Barber has no tenant';
  END IF;

  -- 🔥 validare serviciu
  IF NOT EXISTS (
    SELECT 1
    FROM barber_services
    WHERE id = p_barber_service_id
      AND barber_id = p_barber_id
  ) THEN
    RAISE EXCEPTION 'Invalid barber service';
  END IF;

  -- 🔥 anti overlap
  IF EXISTS (
    SELECT 1
    FROM bookings
    WHERE barber_id = p_barber_id
      AND date = p_date
      AND start_time < p_end
      AND end_time > p_start
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Slot already booked';
  END IF;

  -- 🔥 INSERT FINAL (CU TOKENURI!)
  INSERT INTO bookings (
    barber_id,
    tenant_id,
    barber_service_id,
    date,
    start_time,
    end_time,
    client_name,
    client_phone,
    client_email,
    status,
    cancel_token,
    reschedule_token,
    reschedule_count,
    created_at
  )
  VALUES (
    p_barber_id,
    v_tenant_id,
    p_barber_service_id,
    p_date,
    p_start,
    p_end,
    p_client_name,
    p_client_phone,
    p_client_email,
    'confirmed',
    gen_random_uuid(), -- cancel
    gen_random_uuid(), -- 🔥 RESCHEDULE TOKEN (CRITIC)
    p_reschedule_count,
    now()
  )
  RETURNING * INTO new_booking;

  RETURN new_booking;

END;
$function$;

CREATE OR REPLACE FUNCTION public.create_booking_safe_v2(p_barber_id uuid, p_barber_service_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_client_name text, p_client_phone text, p_client_email text, p_reschedule_count integer DEFAULT 0, p_exclude_booking_id uuid DEFAULT NULL::uuid)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_booking bookings;
  v_tenant_id uuid;
BEGIN

  SELECT tenant_id
  INTO v_tenant_id
  FROM barbers
  WHERE id = p_barber_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Barber has no tenant';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM barber_services
    WHERE id = p_barber_service_id
      AND barber_id = p_barber_id
  ) THEN
    RAISE EXCEPTION 'Invalid barber service';
  END IF;

  -- 🔥 FIX REAL (exclude booking curent)
  IF EXISTS (
    SELECT 1
    FROM bookings
    WHERE barber_id = p_barber_id
      AND date = p_date
      AND start_time < p_end
      AND end_time > p_start
      AND status != 'cancelled'
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
  ) THEN
    RAISE EXCEPTION 'Slot already booked';
  END IF;

  INSERT INTO bookings (
    barber_id,
    tenant_id,
    barber_service_id,
    date,
    start_time,
    end_time,
    client_name,
    client_phone,
    client_email,
    status,
    cancel_token,
    reschedule_token,
    reschedule_count,
    created_at
  )
  VALUES (
    p_barber_id,
    v_tenant_id,
    p_barber_service_id,
    p_date,
    p_start,
    p_end,
    p_client_name,
    p_client_phone,
    p_client_email,
    'confirmed',
    gen_random_uuid(),
    gen_random_uuid(),
    p_reschedule_count,
    now()
  )
  RETURNING * INTO new_booking;

  RETURN new_booking;

END;
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_booking_safe(p_token uuid, p_new_date date, p_new_start time without time zone, p_new_end time without time zone)
 RETURNS TABLE(id uuid, date date, start_time time without time zone, end_time time without time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_booking bookings%rowtype;
  v_diff_hours numeric;
begin
  -- 1️⃣ găsim booking-ul
  select *
  into v_booking
  from bookings
  where cancel_token = p_token
    and status = 'confirmed'
  for update;

  if not found then
    raise exception 'INVALID_TOKEN';
  end if;

  -- 2️⃣ verificare timp (>= 3 ore)
  v_diff_hours :=
    extract(epoch from (
      (v_booking.date + v_booking.start_time) - now()
    )) / 3600;

  if v_diff_hours < 3 then
    raise exception 'RESCHEDULE_WINDOW_EXPIRED';
  end if;

  -- 3️⃣ verificare slot liber
  if exists (
    select 1
    from bookings
    where barber_id = v_booking.barber_id
      and date = p_new_date
      and start_time = p_new_start
      and status = 'confirmed'
      and id <> v_booking.id
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  -- 4️⃣ update atomic
  update bookings
  set
    date = p_new_date,
    start_time = p_new_start,
    end_time = p_new_end,
    rescheduled_from = v_booking.id
  where id = v_booking.id
  returning bookings.id, bookings.date, bookings.start_time, bookings.end_time
  into id, date, start_time, end_time;

  return;
end;
$function$;

create view public."barbers_public" with (security_invoker = true) as
SELECT id,
    display_name,
    active,
    tenant_id,
    phone,
    slug,
    avatar_url,
    bio,
    instagram_url
   FROM barbers
  WHERE active = true;

CREATE TRIGGER barber_services_updated_at BEFORE UPDATE ON barber_services FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trigger_prevent_overlap BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION prevent_booking_overlap();

alter table public."barber_day_overrides" enable row level security;

alter table public."barber_google_accounts" enable row level security;

alter table public."barber_invitations" enable row level security;

alter table public."barber_services" enable row level security;

alter table public."barber_settings" enable row level security;

alter table public."barber_weekly_schedule" enable row level security;

alter table public."barbers" enable row level security;

alter table public."booking_cancellations" enable row level security;

alter table public."bookings" enable row level security;

alter table public."city_seo_pages" enable row level security;

alter table public."marketing_ai_generations" enable row level security;

alter table public."notification_settings" enable row level security;

alter table public."plans" enable row level security;

alter table public."platform_tenant_notes" enable row level security;

alter table public."profiles" enable row level security;

alter table public."salon_gallery" enable row level security;

alter table public."salon_reviews" enable row level security;

alter table public."slug_redirects" enable row level security;

alter table public."sms_sends" enable row level security;

alter table public."subscriptions" enable row level security;

alter table public."tenant_fiscal_invoices" enable row level security;

alter table public."tenant_users" enable row level security;

alter table public."tenants" enable row level security;

alter table public."user_active_tenant" enable row level security;

create policy "barber_overrides_all" on public."barber_day_overrides"
as permissive for all to "authenticated"
using ((tenant_id = get_current_tenant_id()))
with check ((tenant_id = get_current_tenant_id()));

create policy "public_read_day_overrides" on public."barber_day_overrides"
as permissive for select to public
using ((barber_id IN ( SELECT barbers.id
   FROM barbers
  WHERE (barbers.active = true))));

create policy "barber_google_accounts_own" on public."barber_google_accounts"
as permissive for all to "authenticated"
using ((EXISTS ( SELECT 1
   FROM barbers b
  WHERE ((b.id = barber_google_accounts.barber_id) AND (b.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM barbers b
  WHERE ((b.id = barber_google_accounts.barber_id) AND (b.user_id = auth.uid())))));

create policy "barber_invitations_tenant_delete" on public."barber_invitations"
as permissive for delete to "authenticated"
using (((tenant_id = get_current_tenant_id()) AND (get_current_role() = ANY (ARRAY['owner'::text, 'manager'::text]))));

create policy "barber_invitations_tenant_insert" on public."barber_invitations"
as permissive for insert to "authenticated"
with check (((tenant_id = get_current_tenant_id()) AND (get_current_role() = ANY (ARRAY['owner'::text, 'manager'::text]))));

create policy "barber_invitations_tenant_read" on public."barber_invitations"
as permissive for select to "authenticated"
using (((tenant_id = get_current_tenant_id()) AND (get_current_role() = ANY (ARRAY['owner'::text, 'manager'::text]))));

create policy "Public can read barber services" on public."barber_services"
as permissive for select to public
using (true);

create policy "barber_services_all" on public."barber_services"
as permissive for all to "authenticated"
using ((tenant_id = get_current_tenant_id()))
with check ((tenant_id = get_current_tenant_id()));

create policy "barber_settings_all" on public."barber_settings"
as permissive for all to "authenticated"
using ((tenant_id = get_current_tenant_id()))
with check ((tenant_id = get_current_tenant_id()));

create policy "barber_weekly_schedule_read_public" on public."barber_weekly_schedule"
as permissive for select to public
using (true);

create policy "barbers_all" on public."barbers"
as permissive for all to "authenticated"
using ((tenant_id = get_current_tenant_id()))
with check ((tenant_id = get_current_tenant_id()));

create policy "barbers_insert_own" on public."barbers"
as permissive for insert to public
with check ((auth.uid() = user_id));

create policy "barbers_select_own" on public."barbers"
as permissive for select to public
using ((auth.uid() = user_id));

create policy "booking_cancellations_tenant_insert" on public."booking_cancellations"
as permissive for insert to "authenticated"
with check ((booking_id IN ( SELECT b.id
   FROM bookings b
  WHERE (b.tenant_id = get_current_tenant_id()))));

create policy "booking_cancellations_tenant_read" on public."booking_cancellations"
as permissive for select to "authenticated"
using ((booking_id IN ( SELECT b.id
   FROM bookings b
  WHERE (b.tenant_id = get_current_tenant_id()))));

create policy "Barber can read own bookings" on public."bookings"
as permissive for select to public
using ((EXISTS ( SELECT 1
   FROM barbers
  WHERE ((barbers.id = bookings.barber_id) AND (barbers.user_id = auth.uid())))));

create policy "Barber can update own bookings" on public."bookings"
as permissive for update to public
using ((EXISTS ( SELECT 1
   FROM barbers
  WHERE ((barbers.id = bookings.barber_id) AND (barbers.user_id = auth.uid())))));

create policy "bookings_delete" on public."bookings"
as permissive for delete to "authenticated"
using (((tenant_id = get_current_tenant_id()) AND ((get_current_role() = ANY (ARRAY['owner'::text, 'manager'::text])) OR (barber_id = get_current_barber_id()))));

create policy "bookings_insert" on public."bookings"
as permissive for insert to "authenticated"
with check (((tenant_id = get_current_tenant_id()) AND ((get_current_role() = ANY (ARRAY['owner'::text, 'manager'::text])) OR (barber_id = get_current_barber_id()))));

create policy "bookings_select" on public."bookings"
as permissive for select to "authenticated"
using (((tenant_id = get_current_tenant_id()) AND ((get_current_role() = ANY (ARRAY['owner'::text, 'manager'::text])) OR (barber_id = get_current_barber_id()))));

create policy "bookings_tenant_read" on public."bookings"
as permissive for select to "authenticated"
using (((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))) OR (tenant_id IN ( SELECT b.tenant_id
   FROM barbers b
  WHERE (b.user_id = auth.uid())))));

create policy "bookings_tenant_update" on public."bookings"
as permissive for update to "authenticated"
using (((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))) OR (barber_id IN ( SELECT b.id
   FROM barbers b
  WHERE (b.user_id = auth.uid())))))
with check (((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))) OR (barber_id IN ( SELECT b.id
   FROM barbers b
  WHERE (b.user_id = auth.uid())))));

create policy "bookings_update" on public."bookings"
as permissive for update to "authenticated"
using (((tenant_id = get_current_tenant_id()) AND ((get_current_role() = ANY (ARRAY['owner'::text, 'manager'::text])) OR (barber_id = get_current_barber_id()))));

create policy "tenant read bookings" on public."bookings"
as permissive for select to public
using ((tenant_id IN ( SELECT user_active_tenant.tenant_id
   FROM user_active_tenant
  WHERE (user_active_tenant.user_id = auth.uid()))));

create policy "notification_settings_insert" on public."notification_settings"
as permissive for insert to "authenticated"
with check ((EXISTS ( SELECT 1
   FROM tenant_users tu
  WHERE ((tu.tenant_id = notification_settings.tenant_id) AND (tu.user_id = auth.uid())))));

create policy "notification_settings_select" on public."notification_settings"
as permissive for select to "authenticated"
using ((EXISTS ( SELECT 1
   FROM tenant_users tu
  WHERE ((tu.tenant_id = notification_settings.tenant_id) AND (tu.user_id = auth.uid())))));

create policy "notification_settings_tenant_read" on public."notification_settings"
as permissive for select to "authenticated"
using (((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))) OR (tenant_id IN ( SELECT b.tenant_id
   FROM barbers b
  WHERE (b.user_id = auth.uid())))));

create policy "notification_settings_tenant_write" on public."notification_settings"
as permissive for all to "authenticated"
using (((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))) OR (tenant_id IN ( SELECT b.tenant_id
   FROM barbers b
  WHERE (b.user_id = auth.uid())))))
with check (((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))) OR (tenant_id IN ( SELECT b.tenant_id
   FROM barbers b
  WHERE (b.user_id = auth.uid())))));

create policy "notification_settings_update" on public."notification_settings"
as permissive for update to "authenticated"
using ((EXISTS ( SELECT 1
   FROM tenant_users tu
  WHERE ((tu.tenant_id = notification_settings.tenant_id) AND (tu.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM tenant_users tu
  WHERE ((tu.tenant_id = notification_settings.tenant_id) AND (tu.user_id = auth.uid())))));

create policy "plans_public_read" on public."plans"
as permissive for select to public
using (true);

create policy "profiles_own" on public."profiles"
as permissive for all to "authenticated"
using ((id = auth.uid()))
with check ((id = auth.uid()));

create policy "tenant gallery delete" on public."salon_gallery"
as permissive for delete to public
using ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));

create policy "tenant gallery insert" on public."salon_gallery"
as permissive for insert to public
with check ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));

create policy "tenant gallery read" on public."salon_gallery"
as permissive for select to public
using ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));

create policy "tenant gallery update" on public."salon_gallery"
as permissive for update to public
using ((tenant_id IN ( SELECT tenant_users.tenant_id
   FROM tenant_users
  WHERE (tenant_users.user_id = auth.uid()))));

create policy "subscriptions_tenant_read" on public."subscriptions"
as permissive for select to "authenticated"
using ((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))));

create policy "tenant_fiscal_invoices_owner_read" on public."tenant_fiscal_invoices"
as permissive for select to "authenticated"
using ((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE ((tu.user_id = auth.uid()) AND (tu.role = 'owner'::text)))));

create policy "tenant_users_insert_self" on public."tenant_users"
as permissive for insert to "authenticated"
with check ((user_id = auth.uid()));

create policy "tenant_users_read_own" on public."tenant_users"
as permissive for select to "authenticated"
using ((user_id = auth.uid()));

create policy "tenant_users_same_tenant" on public."tenant_users"
as permissive for select to "authenticated"
using ((tenant_id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))));

create policy "tenants_insert_authenticated" on public."tenants"
as permissive for insert to "authenticated"
with check (true);

create policy "tenants_read_members" on public."tenants"
as permissive for select to "authenticated"
using ((id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE (tu.user_id = auth.uid()))));

create policy "tenants_update_member" on public."tenants"
as permissive for update to "authenticated"
using ((id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE ((tu.user_id = auth.uid()) AND (tu.role = ANY (ARRAY['owner'::text, 'manager'::text]))))))
with check ((id IN ( SELECT tu.tenant_id
   FROM tenant_users tu
  WHERE ((tu.user_id = auth.uid()) AND (tu.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));

create policy "read own active tenant" on public."user_active_tenant"
as permissive for select to public
using ((user_id = auth.uid()));

create policy "update own active tenant" on public."user_active_tenant"
as permissive for update to public
using ((user_id = auth.uid()));

create policy "upsert own active tenant" on public."user_active_tenant"
as permissive for insert to public
with check ((user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('barber-avatars', 'barber-avatars', true, null, null) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('salon-gallery', 'salon-gallery', true, null, null) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('salon-logos', 'salon-logos', true, null, null) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;

grant all on all tables in schema public to service_role;

grant execute on all functions in schema public to authenticated, service_role;

commit;


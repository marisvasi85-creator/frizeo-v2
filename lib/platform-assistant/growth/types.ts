export type GrowthFilter =
  | "zero_bookings"
  | "no_login"
  | "no_services"
  | "no_schedule"
  | "trial_ending_soon"
  | "trial_expired";

export type GrowthTenant = {
  tenant_id: string;
  name: string;
  slug: string;
  phone: string | null;
  city: string | null;
  created_at: string;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  last_login_at: string | null;
  days_since_login: number | null;
  has_active_barber: boolean;
  has_services: boolean;
  has_working_schedule: boolean;
  first_service_at: string | null;
  first_booking_at: string | null;
  first_booking_date: string | null;
  last_booking_date: string | null;
  bookings_ever: number;
  bookings_last_30d: number;
  subscription_status: string | null;
  plan_slug: string | null;
  plan_name: string | null;
  trial_ends_at: string | null;
  subscription_created_at: string | null;
  subscription_updated_at: string | null;
  has_stripe: boolean;
  is_paid: boolean;
  is_trialing: boolean;
  trial_expired: boolean;
  trial_ending_soon: boolean;
  converted_at: string | null;
  onboarded: boolean;
  health_issues: string[];
};

export type ConversionRow = {
  tenant_id: string | null;
  conversion_type: string;
  occurred_at: string;
  plan_slug: string | null;
};

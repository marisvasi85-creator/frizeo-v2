import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { PLAN_SLUGS } from "@/lib/billing/plans";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listAllAuthUsers, paginateTable } from "./paginate";
import type { ConversionRow, GrowthTenant } from "./types";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  created_at: string;
  location_city: string | null;
  billing_city: string | null;
};

type SubRow = {
  tenant_id: string;
  status: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  plans: { name?: string; slug?: string } | { name?: string; slug?: string }[] | null;
};

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string): number {
  const a = Date.parse(`${fromDate}T00:00:00.000Z`);
  const b = Date.parse(`${toDate}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function unwrapPlan(
  plans: SubRow["plans"] | undefined,
): { name?: string; slug?: string } | null {
  if (!plans) return null;
  if (Array.isArray(plans)) return plans[0] ?? null;
  return plans;
}

function isPaidPlan(
  status: string | null,
  planSlug: string | null,
  hasStripe: boolean,
): boolean {
  if (status !== "active") return false;
  if (
    planSlug === PLAN_SLUGS.PRO ||
    planSlug === PLAN_SLUGS.PRO_PLUS ||
    planSlug === PLAN_SLUGS.CUSTOM
  ) {
    return true;
  }
  return hasStripe;
}

export function inDateWindow(
  iso: string | null | undefined,
  fromDate: string,
  toDate: string,
): boolean {
  const day = dateOnly(iso);
  if (!day) return false;
  return day >= fromDate && day <= toDate;
}

export async function loadGrowthSnapshot(): Promise<{
  today: string;
  tenants: GrowthTenant[];
  conversions: ConversionRow[];
  error?: string;
}> {
  const today = getTodayInBookingTimezone();
  const last30 = addDaysToDateString(today, -29);
  const trialSoonUntil = addDaysToDateString(today, 3);

  const [
    tenantsPage,
    barbersPage,
    servicesPage,
    schedulePage,
    subsPage,
    membersPage,
    bookingsPage,
    conversionsPage,
    profilesPage,
  ] = await Promise.all([
    paginateTable<TenantRow>((from, to) =>
      supabaseAdmin
        .from("tenants")
        .select(
          "id, name, slug, phone, created_at, location_city, billing_city",
        )
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    paginateTable<{
      id: string;
      tenant_id: string;
      active: boolean | null;
      user_id: string | null;
    }>((from, to) =>
      supabaseAdmin
        .from("barbers")
        .select("id, tenant_id, active, user_id")
        .range(from, to),
    ),
    paginateTable<{
      tenant_id: string | null;
      barber_id: string;
      active: boolean;
      created_at: string | null;
    }>((from, to) =>
      supabaseAdmin
        .from("barber_services")
        .select("tenant_id, barber_id, active, created_at")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    paginateTable<{
      barber_id: string;
      is_working: boolean | null;
    }>((from, to) =>
      supabaseAdmin
        .from("barber_weekly_schedule")
        .select("barber_id, is_working")
        .eq("is_working", true)
        .range(from, to),
    ),
    paginateTable((from, to) =>
      supabaseAdmin
        .from("subscriptions")
        .select(
          "tenant_id, status, trial_ends_at, stripe_subscription_id, created_at, updated_at, plans(name, slug)",
        )
        .range(from, to),
    ),
    paginateTable<{ tenant_id: string; user_id: string; role: string }>(
      (from, to) =>
        supabaseAdmin
          .from("tenant_users")
          .select("tenant_id, user_id, role")
          .range(from, to),
    ),
    paginateTable<{
      tenant_id: string | null;
      date: string;
      created_at: string | null;
    }>((from, to) =>
      supabaseAdmin
        .from("bookings")
        .select("tenant_id, date, created_at")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    paginateTable<ConversionRow>((from, to) =>
      supabaseAdmin
        .from("marketing_conversions")
        .select("tenant_id, conversion_type, occurred_at, plan_slug")
        .order("occurred_at", { ascending: true })
        .range(from, to),
    ),
    paginateTable<{ id: string; full_name: string | null }>((from, to) =>
      supabaseAdmin.from("profiles").select("id, full_name").range(from, to),
    ),
  ]);

  const firstError =
    tenantsPage.error ||
    barbersPage.error ||
    servicesPage.error ||
    schedulePage.error ||
    membersPage.error ||
    bookingsPage.error ||
    subsPage.error ||
    null;

  const conversionMissing = Boolean(
    conversionsPage.error &&
      /does not exist|schema cache|42P01/i.test(conversionsPage.error),
  );
  const conversions = conversionMissing ? [] : conversionsPage.rows;
  const conversionError =
    conversionsPage.error && !conversionMissing ? conversionsPage.error : null;

  const authById = await listAllAuthUsers();
  const profileName = new Map(
    (profilesPage.rows ?? []).map((p) => [p.id, p.full_name]),
  );

  const ownersByTenant = new Map<string, string[]>();
  const membersByTenant = new Map<string, string[]>();
  for (const row of membersPage.rows) {
    const members = membersByTenant.get(row.tenant_id) ?? [];
    members.push(row.user_id);
    membersByTenant.set(row.tenant_id, members);
    if (row.role === "owner") {
      const owners = ownersByTenant.get(row.tenant_id) ?? [];
      owners.push(row.user_id);
      ownersByTenant.set(row.tenant_id, owners);
    }
  }

  const activeBarbersByTenant = new Map<string, number>();
  const barberTenant = new Map<string, string>();
  for (const barber of barbersPage.rows) {
    barberTenant.set(barber.id, barber.tenant_id);
    if (!barber.active) continue;
    activeBarbersByTenant.set(
      barber.tenant_id,
      (activeBarbersByTenant.get(barber.tenant_id) || 0) + 1,
    );
  }

  const firstServiceAt = new Map<string, string>();
  const hasServices = new Set<string>();
  for (const service of servicesPage.rows) {
    const tenantId = service.tenant_id || barberTenant.get(service.barber_id);
    if (!tenantId) continue;
    hasServices.add(tenantId);
    if (service.created_at && !firstServiceAt.has(tenantId)) {
      firstServiceAt.set(tenantId, service.created_at);
    }
  }

  const hasSchedule = new Set<string>();
  for (const row of schedulePage.rows) {
    const tenantId = barberTenant.get(row.barber_id);
    if (tenantId) hasSchedule.add(tenantId);
  }

  const firstBookingAt = new Map<string, string>();
  const firstBookingDate = new Map<string, string>();
  const lastBookingDate = new Map<string, string>();
  const bookingsEver = new Map<string, number>();
  const bookingsLast30 = new Map<string, number>();
  for (const booking of bookingsPage.rows) {
    const tenantId = booking.tenant_id;
    if (!tenantId) continue;
    bookingsEver.set(tenantId, (bookingsEver.get(tenantId) || 0) + 1);
    if (!firstBookingAt.has(tenantId)) {
      firstBookingAt.set(tenantId, booking.created_at || booking.date);
      firstBookingDate.set(tenantId, booking.date);
    }
    lastBookingDate.set(tenantId, booking.date);
    if (booking.date >= last30 && booking.date <= today) {
      bookingsLast30.set(tenantId, (bookingsLast30.get(tenantId) || 0) + 1);
    }
  }

  const subByTenant = new Map(
    (subsPage.rows as unknown as SubRow[]).map((s) => [s.tenant_id, s]),
  );

  const convertedAt = new Map<string, string>();
  for (const row of conversions) {
    if (row.conversion_type !== "subscription_started" || !row.tenant_id) {
      continue;
    }
    if (!convertedAt.has(row.tenant_id)) {
      convertedAt.set(row.tenant_id, row.occurred_at);
    }
  }

  const tenants: GrowthTenant[] = tenantsPage.rows.map((tenant) => {
    const ownerIds = ownersByTenant.get(tenant.id) ?? [];
    const memberIds = membersByTenant.get(tenant.id) ?? ownerIds;
    const ownerId = ownerIds[0] ?? memberIds[0] ?? null;
    const ownerAuth = ownerId ? authById.get(ownerId) : undefined;

    let lastLogin: string | null = null;
    for (const userId of memberIds) {
      const auth = authById.get(userId);
      const stamp = auth?.last_sign_in_at;
      if (!stamp) continue;
      if (!lastLogin || stamp > lastLogin) lastLogin = stamp;
    }

    const sub = subByTenant.get(tenant.id);
    const plan = unwrapPlan(sub?.plans);
    const planSlug = plan?.slug || null;
    const status = sub?.status || null;
    const hasStripe = Boolean(sub?.stripe_subscription_id);
    const trialEnd = dateOnly(sub?.trial_ends_at);
    const paid = isPaidPlan(status, planSlug, hasStripe);
    const isTrialing = status === "trialing" && (!trialEnd || trialEnd >= today);
    const trialExpired =
      status === "trialing" && Boolean(trialEnd && trialEnd < today);
    const trialEndingSoon = Boolean(
      isTrialing && trialEnd && trialEnd <= trialSoonUntil,
    );

    const health: string[] = [];
    const hasBarber = (activeBarbersByTenant.get(tenant.id) || 0) > 0;
    const services = hasServices.has(tenant.id);
    const schedule = hasSchedule.has(tenant.id);
    if (!hasBarber) health.push("fără frizer activ");
    if (hasBarber && !services) health.push("fără servicii");
    if (!schedule) health.push("fără program de lucru");
    if (status === "past_due") health.push("past_due");
    if (trialExpired) health.push("trial expirat");
    if ((bookingsEver.get(tenant.id) || 0) === 0) {
      health.push("nicio programare");
    }

    const onboarded = Boolean(
      lastLogin && hasBarber && services && schedule,
    );

    return {
      tenant_id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      phone: tenant.phone,
      city: tenant.location_city || tenant.billing_city || null,
      created_at: tenant.created_at,
      owner_user_id: ownerId,
      owner_name:
        profileName.get(ownerId || "") ||
        ownerAuth?.full_name ||
        null,
      owner_email: ownerAuth?.email || null,
      last_login_at: lastLogin,
      days_since_login: lastLogin
        ? daysBetween(dateOnly(lastLogin) || today, today)
        : daysBetween(dateOnly(tenant.created_at) || today, today),
      has_active_barber: hasBarber,
      has_services: services,
      has_working_schedule: schedule,
      first_service_at: firstServiceAt.get(tenant.id) || null,
      first_booking_at: firstBookingAt.get(tenant.id) || null,
      first_booking_date: firstBookingDate.get(tenant.id) || null,
      last_booking_date: lastBookingDate.get(tenant.id) || null,
      bookings_ever: bookingsEver.get(tenant.id) || 0,
      bookings_last_30d: bookingsLast30.get(tenant.id) || 0,
      subscription_status: status,
      plan_slug: planSlug,
      plan_name: plan?.name || null,
      trial_ends_at: sub?.trial_ends_at || null,
      subscription_created_at: sub?.created_at || null,
      subscription_updated_at: sub?.updated_at || null,
      has_stripe: hasStripe,
      is_paid: paid,
      is_trialing: isTrialing,
      trial_expired: trialExpired,
      trial_ending_soon: trialEndingSoon,
      converted_at: convertedAt.get(tenant.id) || null,
      onboarded,
      health_issues: health,
    };
  });

  return {
    today,
    tenants,
    conversions,
    error: firstError || conversionError || undefined,
  };
}

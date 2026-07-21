import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asNumber } from "./helpers";

type SubRow = {
  tenant_id: string;
  status: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
  plans: { name?: string; slug?: string } | null;
};

function mapTenantRow(
  row: SubRow,
  tenantById: Map<string, { id: string; name: string; slug: string }>,
) {
  const tenant = tenantById.get(row.tenant_id);
  const plan = row.plans;
  return {
    tenant_id: row.tenant_id,
    name: tenant?.name || null,
    slug: tenant?.slug || null,
    status: row.status,
    trial_ends_at: row.trial_ends_at,
    plan_name: plan?.name || null,
    has_stripe: Boolean(row.stripe_subscription_id),
  };
}

/**
 * Morning ritual for the Frizeo creator: what needs attention today.
 */
export async function dailyBriefingTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const trialDaysNear = Math.min(Math.max(asNumber(args.trial_days) ?? 7, 1), 30);
  const today = getTodayInBookingTimezone();
  const yesterday = addDaysToDateString(today, -1);
  const trialUntil = addDaysToDateString(today, trialDaysNear);
  const trialUrgentUntil = addDaysToDateString(today, 3);

  // New salons in last ~48h window (created_at after start of yesterday UTC-ish)
  const sinceIso = `${yesterday}T00:00:00.000Z`;

  const [
    newTenantsRes,
    trialsRes,
    pastDueRes,
    bookingsYesterdayRes,
    bookingsTodayRes,
    tenantsRes,
    barbersRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("tenants")
      .select("id, name, slug, created_at, phone")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("subscriptions")
      .select(
        "tenant_id, status, trial_ends_at, stripe_subscription_id, plans(name, slug)",
      )
      .eq("status", "trialing")
      .not("trial_ends_at", "is", null)
      .gte("trial_ends_at", today)
      .lte("trial_ends_at", `${trialUntil}T23:59:59`),
    supabaseAdmin
      .from("subscriptions")
      .select(
        "tenant_id, status, trial_ends_at, stripe_subscription_id, plans(name, slug)",
      )
      .eq("status", "past_due"),
    supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("date", yesterday)
      .neq("status", "cancelled"),
    supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .neq("status", "cancelled"),
    supabaseAdmin.from("tenants").select("id, name, slug"),
    supabaseAdmin.from("barbers").select("id, tenant_id, active"),
  ]);

  const activeBarberIds = (barbersRes.data ?? [])
    .filter((b) => b.active)
    .map((b) => b.id);

  const { data: activeServices } = activeBarberIds.length
    ? await supabaseAdmin
        .from("barber_services")
        .select("barber_id")
        .eq("active", true)
        .in("barber_id", activeBarberIds.slice(0, 500))
    : { data: [] as { barber_id: string }[] };

  const barberTenant = new Map(
    (barbersRes.data ?? []).map((b) => [b.id, b.tenant_id]),
  );

  const tenantById = new Map(
    (tenantsRes.data ?? []).map((t) => [t.id, t]),
  );

  const trials = ((trialsRes.data ?? []) as unknown as SubRow[])
    .map((row) => mapTenantRow(row, tenantById))
    .sort((a, b) =>
      String(a.trial_ends_at || "").localeCompare(String(b.trial_ends_at || "")),
    );

  const trialsUrgent = trials.filter((t) => {
    const end = String(t.trial_ends_at || "").slice(0, 10);
    return end && end <= trialUrgentUntil;
  });

  const pastDue = ((pastDueRes.data ?? []) as unknown as SubRow[]).map((row) =>
    mapTenantRow(row, tenantById),
  );

  const activeBarbersByTenant = new Map<string, number>();
  for (const b of barbersRes.data ?? []) {
    if (!b.active) continue;
    activeBarbersByTenant.set(
      b.tenant_id,
      (activeBarbersByTenant.get(b.tenant_id) || 0) + 1,
    );
  }

  const servicesByTenant = new Map<string, number>();
  for (const s of activeServices ?? []) {
    const tenantId = barberTenant.get(s.barber_id);
    if (!tenantId) continue;
    servicesByTenant.set(tenantId, (servicesByTenant.get(tenantId) || 0) + 1);
  }

  const noActiveBarber = (tenantsRes.data ?? [])
    .filter((t) => (activeBarbersByTenant.get(t.id) || 0) === 0)
    .slice(0, 15)
    .map((t) => ({
      tenant_id: t.id,
      name: t.name,
      slug: t.slug,
      issue: "no_active_barber",
    }));

  const noServices = (tenantsRes.data ?? [])
    .filter(
      (t) =>
        (activeBarbersByTenant.get(t.id) || 0) > 0 &&
        (servicesByTenant.get(t.id) || 0) === 0,
    )
    .slice(0, 15)
    .map((t) => ({
      tenant_id: t.id,
      name: t.name,
      slug: t.slug,
      issue: "no_active_services",
    }));

  const newTenants = (newTenantsRes.data ?? []).map((t) => ({
    tenant_id: t.id,
    name: t.name,
    slug: t.slug,
    phone: t.phone,
    created_at: t.created_at,
  }));

  const actionItems: string[] = [];
  if (pastDue.length > 0) {
    actionItems.push(
      `Contactează ${pastDue.length} salon(e) past_due (plată restantă).`,
    );
  }
  if (trialsUrgent.length > 0) {
    actionItems.push(
      `Follow-up pe ${trialsUrgent.length} trial(uri) care expiră în ≤3 zile.`,
    );
  } else if (trials.length > 0) {
    actionItems.push(
      `Vezi ${trials.length} trial(uri) care expiră în ${trialDaysNear} zile.`,
    );
  }
  if (newTenants.length > 0) {
    actionItems.push(
      `Salută / verifică onboarding pentru ${newTenants.length} salon(e) noi.`,
    );
  }
  if (noActiveBarber.length > 0) {
    actionItems.push(
      `${noActiveBarber.length} salon(e) fără frizer activ — merită un check.`,
    );
  }
  if (noServices.length > 0) {
    actionItems.push(
      `${noServices.length} salon(e) cu frizer dar fără servicii active.`,
    );
  }
  if (actionItems.length === 0) {
    actionItems.push("Nimic urgent — platforma arată ok azi.");
  }

  const data = {
    date: today,
    bookings: {
      yesterday: bookingsYesterdayRes.count ?? 0,
      today: bookingsTodayRes.count ?? 0,
    },
    new_tenants_since_yesterday: newTenants,
    trials_ending_soon: trials,
    trials_urgent_3_days: trialsUrgent,
    past_due: pastDue,
    health: {
      no_active_barber: noActiveBarber,
      no_active_services: noServices,
    },
    action_items: actionItems,
  };

  const summary = [
    `Briefing ${today}:`,
    `${data.bookings.today} programări azi / ${data.bookings.yesterday} ieri.`,
    `${newTenants.length} saloane noi, ${trialsUrgent.length} trial-uri urgente (≤3 zile), ${pastDue.length} past_due.`,
    `Health: ${noActiveBarber.length} fără frizer, ${noServices.length} fără servicii.`,
    `Acțiuni: ${actionItems.slice(0, 3).join(" ")}`,
  ].join(" ");

  return { ok: true, summary, data };
}

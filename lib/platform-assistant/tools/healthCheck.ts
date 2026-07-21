import { getTodayInBookingTimezone } from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asNumber, asString, resolveTenant } from "./helpers";

type HealthIssueCode =
  | "no_active_barber"
  | "no_active_services"
  | "past_due"
  | "trial_expired"
  | "no_phone"
  | "no_bookings_ever";

type IssueRow = {
  tenant_id: string;
  name: string;
  slug: string;
  issue: HealthIssueCode;
  detail?: string | null;
};

const ISSUE_LABEL: Record<HealthIssueCode, string> = {
  no_active_barber: "fără frizer activ",
  no_active_services: "fără servicii active",
  past_due: "plată restantă (past_due)",
  trial_expired: "trial expirat (încă trialing)",
  no_phone: "fără telefon pe salon",
  no_bookings_ever: "nicio programare (all-time)",
};

async function healthForTenant(
  tenant: { id: string; name: string; slug: string; phone?: string | null },
  today: string,
): Promise<{
  issues: IssueRow[];
  stats: Record<string, unknown>;
}> {
  const [barbersRes, servicesRes, subRes, bookingsRes] = await Promise.all([
    supabaseAdmin
      .from("barbers")
      .select("id, active, display_name")
      .eq("tenant_id", tenant.id),
    supabaseAdmin
      .from("barber_services")
      .select("id, active")
      .eq("tenant_id", tenant.id)
      .eq("active", true),
    supabaseAdmin
      .from("subscriptions")
      .select("status, trial_ends_at, stripe_subscription_id, plans(name, slug)")
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .neq("status", "cancelled"),
  ]);

  const barbers = barbersRes.data ?? [];
  const activeBarbers = barbers.filter((b) => b.active);
  const activeServices = servicesRes.data ?? [];
  const sub = subRes.data;
  const plan = sub?.plans as { name?: string; slug?: string } | null;
  const bookingsEver = bookingsRes.count ?? 0;

  const issues: IssueRow[] = [];
  const base = {
    tenant_id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
  };

  if (activeBarbers.length === 0) {
    issues.push({ ...base, issue: "no_active_barber" });
  } else if (activeServices.length === 0) {
    issues.push({ ...base, issue: "no_active_services" });
  }

  if (sub?.status === "past_due") {
    issues.push({ ...base, issue: "past_due" });
  }

  if (
    sub?.status === "trialing" &&
    sub.trial_ends_at &&
    String(sub.trial_ends_at).slice(0, 10) < today
  ) {
    issues.push({
      ...base,
      issue: "trial_expired",
      detail: String(sub.trial_ends_at).slice(0, 10),
    });
  }

  if (!tenant.phone?.trim()) {
    issues.push({ ...base, issue: "no_phone" });
  }

  if (bookingsEver === 0) {
    issues.push({ ...base, issue: "no_bookings_ever" });
  }

  return {
    issues,
    stats: {
      active_barbers: activeBarbers.length,
      total_barbers: barbers.length,
      active_services: activeServices.length,
      bookings_ever: bookingsEver,
      subscription_status: sub?.status || null,
      trial_ends_at: sub?.trial_ends_at || null,
      plan_name: plan?.name || null,
      has_stripe: Boolean(sub?.stripe_subscription_id),
      phone: tenant.phone || null,
    },
  };
}

/**
 * Platform or single-tenant health scan for creator ops.
 */
export async function healthCheckTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const today = getTodayInBookingTimezone();
  const limit = Math.min(Math.max(asNumber(args.limit) ?? 30, 1), 100);
  const issueFilter = asString(args.issue) as HealthIssueCode | null;

  const hasLookup =
    Boolean(asString(args.tenant_id)) ||
    Boolean(asString(args.slug)) ||
    Boolean(asString(args.name)) ||
    Boolean(asString(args.tenant_name));

  if (hasLookup) {
    const resolved = await resolveTenant(args);
    if (resolved.ambiguous) {
      return {
        ok: false,
        summary: "Mai multe saloane potrivesc. Specifică slug sau tenant_id.",
        error: "ambiguous",
        data: { candidates: resolved.ambiguous },
      };
    }
    if (!resolved.tenant) {
      return {
        ok: false,
        summary: "Salonul nu a fost găsit.",
        error: "not_found",
      };
    }

    const { issues, stats } = await healthForTenant(resolved.tenant, today);
    const filtered = issueFilter
      ? issues.filter((i) => i.issue === issueFilter)
      : issues;

    if (!filtered.length) {
      return {
        ok: true,
        summary: `Health OK pentru „${resolved.tenant.name}” — fără probleme detectate.`,
        data: {
          mode: "tenant",
          tenant: resolved.tenant,
          stats,
          issues: [],
        },
      };
    }

    const labels = filtered.map((i) => ISSUE_LABEL[i.issue]).join(", ");
    return {
      ok: true,
      summary: `Health „${resolved.tenant.name}”: ${filtered.length} problemă(e) — ${labels}.`,
      data: {
        mode: "tenant",
        tenant: resolved.tenant,
        stats,
        issues: filtered,
      },
    };
  }

  // Platform-wide scan
  const [tenantsRes, barbersRes, servicesRes, subsRes] = await Promise.all([
    supabaseAdmin.from("tenants").select("id, name, slug, phone"),
    supabaseAdmin.from("barbers").select("id, tenant_id, active"),
    supabaseAdmin
      .from("barber_services")
      .select("tenant_id")
      .eq("active", true),
    supabaseAdmin
      .from("subscriptions")
      .select("tenant_id, status, trial_ends_at"),
  ]);

  if (tenantsRes.error) {
    return {
      ok: false,
      summary: "Nu am putut încărca saloanele pentru health check.",
      error: tenantsRes.error.message,
    };
  }

  const tenants = tenantsRes.data ?? [];
  const activeBarbersByTenant = new Map<string, number>();
  for (const b of barbersRes.data ?? []) {
    if (!b.active) continue;
    activeBarbersByTenant.set(
      b.tenant_id,
      (activeBarbersByTenant.get(b.tenant_id) || 0) + 1,
    );
  }

  const servicesByTenant = new Map<string, number>();
  for (const s of servicesRes.data ?? []) {
    if (!s.tenant_id) continue;
    servicesByTenant.set(
      s.tenant_id,
      (servicesByTenant.get(s.tenant_id) || 0) + 1,
    );
  }

  const subByTenant = new Map(
    (subsRes.data ?? []).map((s) => [s.tenant_id, s]),
  );

  // Bookings-ever: only for tenants that otherwise look "set up" to avoid noise,
  // or include as soft issue — we'll sample via count per tenant is expensive.
  // Skip no_bookings_ever on platform-wide (too heavy / noisy); keep for single-tenant.

  const issues: IssueRow[] = [];
  for (const t of tenants) {
    const activeBarbers = activeBarbersByTenant.get(t.id) || 0;
    const services = servicesByTenant.get(t.id) || 0;
    const sub = subByTenant.get(t.id);

    if (activeBarbers === 0) {
      issues.push({
        tenant_id: t.id,
        name: t.name,
        slug: t.slug,
        issue: "no_active_barber",
      });
    } else if (services === 0) {
      issues.push({
        tenant_id: t.id,
        name: t.name,
        slug: t.slug,
        issue: "no_active_services",
      });
    }

    if (sub?.status === "past_due") {
      issues.push({
        tenant_id: t.id,
        name: t.name,
        slug: t.slug,
        issue: "past_due",
      });
    }

    if (
      sub?.status === "trialing" &&
      sub.trial_ends_at &&
      String(sub.trial_ends_at).slice(0, 10) < today
    ) {
      issues.push({
        tenant_id: t.id,
        name: t.name,
        slug: t.slug,
        issue: "trial_expired",
        detail: String(sub.trial_ends_at).slice(0, 10),
      });
    }

    if (!t.phone?.trim()) {
      issues.push({
        tenant_id: t.id,
        name: t.name,
        slug: t.slug,
        issue: "no_phone",
      });
    }
  }

  const filtered = issueFilter
    ? issues.filter((i) => i.issue === issueFilter)
    : issues;

  const byIssue: Record<string, number> = {};
  for (const i of filtered) {
    byIssue[i.issue] = (byIssue[i.issue] || 0) + 1;
  }

  // Prioritize: past_due > trial_expired > no_barber > no_services > no_phone
  const priority: HealthIssueCode[] = [
    "past_due",
    "trial_expired",
    "no_active_barber",
    "no_active_services",
    "no_phone",
  ];
  filtered.sort((a, b) => {
    const pa = priority.indexOf(a.issue);
    const pb = priority.indexOf(b.issue);
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  });

  const top = filtered.slice(0, limit);
  const countsLabel = Object.entries(byIssue)
    .map(([k, n]) => `${n} ${ISSUE_LABEL[k as HealthIssueCode] || k}`)
    .join("; ");

  return {
    ok: true,
    summary: filtered.length
      ? `Health platformă: ${filtered.length} issue(uri). ${countsLabel}. Top ${top.length} listate.`
      : "Health platformă: fără probleme detectate.",
    data: {
      mode: "platform",
      total_tenants: tenants.length,
      total_issues: filtered.length,
      by_issue: byIssue,
      issues: top,
    },
  };
}

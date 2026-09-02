import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { resolveTenant } from "./helpers";

type TimelineEvent = {
  at: string;
  type: string;
  label: string;
  detail?: string | null;
};

function pushEvent(
  events: TimelineEvent[],
  at: string | null | undefined,
  type: string,
  label: string,
  detail?: string | null,
) {
  if (!at) return;
  events.push({ at, type, label, detail: detail || null });
}

export async function tenantTimelineTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
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
      summary: "Salonul nu a fost găsit. Specifică name, slug sau tenant_id.",
      error: "not_found",
    };
  }

  const tenantId = resolved.tenant.id;

  const [
    tenantRes,
    subRes,
    barbersRes,
    servicesRes,
    scheduleRes,
    membersRes,
    firstBookingRes,
    lastBookingRes,
    bookingsCountRes,
    conversionsRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("tenants")
      .select(
        "id, name, slug, phone, created_at, location_city, billing_city",
      )
      .eq("id", tenantId)
      .maybeSingle(),
    supabaseAdmin
      .from("subscriptions")
      .select(
        "status, trial_ends_at, stripe_subscription_id, created_at, updated_at, plans(name, slug)",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabaseAdmin
      .from("barbers")
      .select("id, display_name, active")
      .eq("tenant_id", tenantId),
    supabaseAdmin
      .from("barber_services")
      .select("id, created_at, active, barber_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(20),
    supabaseAdmin
      .from("barber_weekly_schedule")
      .select("id, is_working")
      .eq("tenant_id", tenantId)
      .eq("is_working", true)
      .limit(1),
    supabaseAdmin
      .from("tenant_users")
      .select("user_id, role, created_at")
      .eq("tenant_id", tenantId),
    supabaseAdmin
      .from("bookings")
      .select("created_at, date")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true })
      .limit(1),
    supabaseAdmin
      .from("bookings")
      .select("date, created_at")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .order("date", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled"),
    supabaseAdmin
      .from("marketing_conversions")
      .select("conversion_type, occurred_at, plan_slug")
      .eq("tenant_id", tenantId)
      .order("occurred_at", { ascending: true }),
  ]);

  const tenant = tenantRes.data;
  if (!tenant) {
    return { ok: false, summary: "Salonul nu a fost găsit.", error: "not_found" };
  }

  const members = membersRes.data ?? [];
  const owner = members.find((m) => m.role === "owner") ?? members[0];

  const authById = new Map<
    string,
    { email: string | null; last_sign_in_at: string | null; full_name: string | null }
  >();
  for (const row of members) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      const user = data.user;
      if (!user) continue;
      const meta = user.user_metadata as
        | { full_name?: string; name?: string }
        | undefined;
      authById.set(user.id, {
        email: user.email ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
        full_name: meta?.full_name || meta?.name || null,
      });
    } catch {
      // ignore
    }
  }
  const ownerAuth = owner ? authById.get(owner.user_id) : undefined;

  let lastLogin: string | null = null;
  for (const row of members) {
    const stamp = authById.get(row.user_id)?.last_sign_in_at;
    if (stamp && (!lastLogin || stamp > lastLogin)) lastLogin = stamp;
  }

  const sub = subRes.data;
  const rawPlan = sub?.plans as
    | { name?: string; slug?: string }
    | { name?: string; slug?: string }[]
    | null;
  const plan = Array.isArray(rawPlan) ? rawPlan[0] ?? null : rawPlan;
  const firstService = (servicesRes.data ?? []).find((s) => s.created_at);
  const firstBooking = firstBookingRes.data?.[0];
  const lastBooking = lastBookingRes.data?.[0];
  const conversions = conversionsRes.error ? [] : conversionsRes.data ?? [];

  const events: TimelineEvent[] = [];
  pushEvent(events, tenant.created_at, "signup", "Cont creat");
  if (owner?.created_at) {
    pushEvent(
      events,
      owner.created_at,
      "owner",
      "Owner asociat",
      ownerAuth?.email || null,
    );
  }
  pushEvent(
    events,
    lastLogin,
    "login",
    "Ultima logare",
    ownerAuth?.email || null,
  );
  pushEvent(
    events,
    firstService?.created_at,
    "services",
    "Servicii adăugate",
    `${(servicesRes.data ?? []).length} servicii (inclusiv default la signup)`,
  );
  if ((scheduleRes.data ?? []).length > 0) {
    events.push({
      at: tenant.created_at,
      type: "schedule",
      label: "Program de lucru prezent",
      detail:
        "Nu avem timestamp de editare. La signup se creează program default L–S.",
    });
  }
  pushEvent(
    events,
    firstBooking?.created_at || firstBooking?.date,
    "first_booking",
    "Prima programare",
    firstBooking?.date || null,
  );
  if (
    lastBooking &&
    lastBooking.date !== firstBooking?.date
  ) {
    pushEvent(
      events,
      lastBooking.date,
      "last_booking",
      "Ultima programare",
      lastBooking.date,
    );
  }
  pushEvent(
    events,
    sub?.created_at,
    "trial",
    "Abonament creat",
    `${plan?.name || "plan"} · ${sub?.status || "—"}`,
  );
  if (sub?.trial_ends_at) {
    pushEvent(
      events,
      sub.trial_ends_at,
      "trial_end",
      "Trial se încheie / s-a încheiat",
      String(sub.trial_ends_at).slice(0, 10),
    );
  }
  for (const conv of conversions) {
    const labels: Record<string, string> = {
      signup: "Conversie signup (attribuire)",
      trial_started: "Trial început (attribuire)",
      subscription_started: "Trecut pe Pro",
    };
    pushEvent(
      events,
      conv.occurred_at,
      conv.conversion_type,
      labels[conv.conversion_type] || conv.conversion_type,
      conv.plan_slug,
    );
  }
  if (
    sub?.updated_at &&
    sub.updated_at !== sub.created_at
  ) {
    pushEvent(
      events,
      sub.updated_at,
      "plan_update",
      "Ultima actualizare abonament",
      `${plan?.name || "plan"} · ${sub.status}${
        sub.stripe_subscription_id ? " · Stripe da" : " · fără Stripe"
      }`,
    );
  }

  events.sort((a, b) => a.at.localeCompare(b.at));

  const summary = [
    `Timeline „${tenant.name}”:`,
    `cont ${String(tenant.created_at).slice(0, 10)},`,
    lastLogin
      ? `ultima logare ${String(lastLogin).slice(0, 10)},`
      : "fără login,",
    firstBooking
      ? `prima programare ${firstBooking.date},`
      : "fără programări,",
    `${bookingsCountRes.count ?? 0} programări all-time,`,
    `plan ${plan?.name || "—"} (${sub?.status || "fără sub"}).`,
  ].join(" ");

  return {
    ok: true,
    summary,
    data: {
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        phone: tenant.phone,
        city: tenant.location_city || tenant.billing_city || null,
        owner_email: ownerAuth?.email || null,
        owner_name: ownerAuth?.full_name || null,
      },
      stats: {
        bookings_ever: bookingsCountRes.count ?? 0,
        has_schedule: (scheduleRes.data ?? []).length > 0,
        barbers: (barbersRes.data ?? []).length,
      },
      events,
    },
  };
}

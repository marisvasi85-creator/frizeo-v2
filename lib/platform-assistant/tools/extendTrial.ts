import { getTodayInBookingTimezone } from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asBoolean, asNumber, asString } from "./helpers";

async function resolveTenant(args: Record<string, unknown>) {
  const tenantId = asString(args.tenant_id);
  const slug = asString(args.slug)?.toLowerCase() || null;
  const nameQuery = asString(args.name) || asString(args.tenant_name);

  if (tenantId) {
    const { data } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug")
      .eq("id", tenantId)
      .maybeSingle();
    return { tenant: data, ambiguous: null as null | unknown[] };
  }

  if (slug) {
    const { data } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug")
      .eq("slug", slug)
      .maybeSingle();
    return { tenant: data, ambiguous: null };
  }

  if (nameQuery) {
    const { data } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug")
      .ilike("name", `%${nameQuery}%`)
      .limit(5);
    if (!data?.length) return { tenant: null, ambiguous: null };
    if (data.length > 1) {
      return {
        tenant: null,
        ambiguous: data.map((t) => ({
          tenant_id: t.id,
          name: t.name,
          slug: t.slug,
        })),
      };
    }
    return { tenant: data[0], ambiguous: null };
  }

  return { tenant: null, ambiguous: null };
}

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  if (Number.isNaN(d.getTime())) {
    const today = getTodayInBookingTimezone();
    const fallback = new Date(`${today}T12:00:00.000Z`);
    fallback.setUTCDate(fallback.getUTCDate() + days);
    return fallback.toISOString();
  }
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * Creator-only: extend a tenant's trial_ends_at by N days.
 */
export async function extendTrialTool(
  args: Record<string, unknown>,
  ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const days = Math.min(Math.max(asNumber(args.days) ?? 7, 1), 90);
  const confirmed = asBoolean(args.confirmed);
  const reason = asString(args.reason);

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

  const tenant = resolved.tenant;
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, status, trial_ends_at, stripe_subscription_id, plans(name, slug)",
    )
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!subscription) {
    return {
      ok: false,
      summary: "Salonul nu are subscription.",
      error: "no_subscription",
    };
  }

  const plan = subscription.plans as { name?: string; slug?: string } | null;
  const today = getTodayInBookingTimezone();
  const baseIso =
    subscription.trial_ends_at &&
    String(subscription.trial_ends_at).slice(0, 10) >= today
      ? subscription.trial_ends_at
      : `${today}T23:59:59.000Z`;

  const newTrialEndsAt = addDaysIso(String(baseIso), days);

  const proposal = {
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    slug: tenant.slug,
    from: {
      status: subscription.status,
      trial_ends_at: subscription.trial_ends_at,
      plan_name: plan?.name || null,
      has_stripe: Boolean(subscription.stripe_subscription_id),
    },
    to: {
      status: "trialing",
      trial_ends_at: newTrialEndsAt,
      extend_days: days,
    },
    reason: reason || "trial extension by creator",
    warning: subscription.stripe_subscription_id
      ? "Există stripe_subscription_id — dacă e abonament plătit activ, verifică în Stripe. Prelungirea trial e doar în Frizeo."
      : null,
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: prelungesc trial-ul pentru „${tenant.name}” cu ${days} zile (până la ${newTrialEndsAt.slice(0, 10)}).`,
      data: {
        needs_confirmation: true,
        action: "extend_trial",
        proposal,
        instruct_user:
          "Cere confirmare. Dacă acceptă, apelează extend_trial din nou cu confirmed=true.",
      },
    };
  }

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "trialing",
      trial_ends_at: newTrialEndsAt,
    })
    .eq("tenant_id", tenant.id);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut prelungi trial-ul.",
      error: error.message,
    };
  }

  console.info("platform extend_trial", {
    by: ctx.email,
    userId: ctx.userId,
    tenantId: tenant.id,
    tenantName: tenant.name,
    days,
    newTrialEndsAt,
    reason: reason || null,
    at: new Date().toISOString(),
  });

  return {
    ok: true,
    summary: `Gata: trial-ul pentru „${tenant.name}” e prelungit cu ${days} zile (până la ${newTrialEndsAt.slice(0, 10)}).`,
    data: {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      trial_ends_at: newTrialEndsAt,
      days,
    },
  };
}

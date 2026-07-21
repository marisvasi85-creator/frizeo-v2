import { getPlanIdBySlug } from "@/lib/billing/getPlanIdBySlug";
import {
  isCanonicalPlanSlug,
  PLAN_SLUGS,
  type PlanSlug,
} from "@/lib/billing/plans";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asBoolean, asString } from "./helpers";

function normalizePlanSlug(raw: string | null): PlanSlug | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace("pro+", "pro-plus")
    .replace("proplus", "pro-plus");

  if (cleaned === "pro" || cleaned === "pro-plus" || cleaned === "free" || cleaned === "custom") {
    return cleaned;
  }

  if (isCanonicalPlanSlug(cleaned)) return cleaned;
  return null;
}

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

/**
 * Creator-only: set a tenant plan in DB (complimentary / manual override).
 * Does not create a Stripe charge. Confirmation required.
 */
export async function setTenantPlanTool(
  args: Record<string, unknown>,
  ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const planSlug = normalizePlanSlug(
    asString(args.plan_slug) || asString(args.plan) || asString(args.plan_name),
  );
  const confirmed = asBoolean(args.confirmed);
  const detachStripe = asBoolean(args.detach_stripe, true);
  const reason = asString(args.reason);

  if (!planSlug) {
    return {
      ok: false,
      summary: "Specifică planul: free, pro, pro-plus sau custom.",
      error: "invalid_plan",
    };
  }

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
      summary: "Salonul nu a fost găsit. Folosește name, slug sau tenant_id.",
      error: "not_found",
    };
  }

  const tenant = resolved.tenant;
  const planId = await getPlanIdBySlug(planSlug);
  if (!planId) {
    return {
      ok: false,
      summary: `Planul „${planSlug}" nu există în baza de date.`,
      error: "plan_missing",
    };
  }

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id, name, slug, max_barbers")
    .eq("id", planId)
    .maybeSingle();

  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, status, trial_ends_at, stripe_subscription_id, stripe_customer_id, plan_id, plans(name, slug)",
    )
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!subscription) {
    return {
      ok: false,
      summary: "Salonul nu are rând de subscription. Creează-l manual în DB întâi.",
      error: "no_subscription",
    };
  }

  const currentPlan = subscription.plans as
    | { name?: string; slug?: string }
    | null
    | undefined;

  const proposal = {
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    slug: tenant.slug,
    from: {
      plan_name: currentPlan?.name || null,
      plan_slug: currentPlan?.slug || null,
      status: subscription.status,
      trial_ends_at: subscription.trial_ends_at,
      has_stripe_subscription: Boolean(subscription.stripe_subscription_id),
    },
    to: {
      plan_name: plan?.name || planSlug,
      plan_slug: planSlug,
      status: "active",
      trial_ends_at: null,
      detach_stripe: detachStripe,
    },
    reason: reason || "complimentary / override creator",
    warning: subscription.stripe_subscription_id
      ? detachStripe
        ? "Abonamentul Stripe va fi detașat din Frizeo (stripe_subscription_id = null). Customer-ul Stripe rămâne. Verifică în Stripe Dashboard dacă trebuie anulat și acolo."
        : "stripe_subscription_id rămâne setat — un webhook Stripe poate rescrie planul ulterior."
      : null,
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: setezi „${tenant.name}" pe planul ${proposal.to.plan_name} (status active)${
        detachStripe && subscription.stripe_subscription_id
          ? ", detașând Stripe subscription"
          : ""
      }.`,
      data: {
        needs_confirmation: true,
        action: "set_tenant_plan",
        proposal,
        instruct_user:
          "Prezintă propunerea și warning-ul Stripe. Dacă Maris confirmă, apelează set_tenant_plan din nou cu aceleași argumente și confirmed=true.",
      },
    };
  }

  const update: Record<string, unknown> = {
    plan_id: planId,
    status: "active",
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
  };

  if (detachStripe) {
    update.stripe_subscription_id = null;
  }

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update(update)
    .eq("tenant_id", tenant.id);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut actualiza abonamentul.",
      error: error.message,
    };
  }

  if (planSlug === PLAN_SLUGS.FREE) {
    await supabaseAdmin
      .from("notification_settings")
      .update({
        booking_sms_enabled: false,
        reminder_sms_enabled: false,
        reschedule_sms_enabled: false,
        cancel_sms_enabled: false,
      })
      .eq("tenant_id", tenant.id);
  }

  console.info("platform set_tenant_plan", {
    by: ctx.email,
    userId: ctx.userId,
    tenantId: tenant.id,
    tenantName: tenant.name,
    planSlug,
    detachStripe,
    reason: reason || null,
    at: new Date().toISOString(),
  });

  return {
    ok: true,
    summary: `Gata: „${tenant.name}" este pe ${proposal.to.plan_name} (active).`,
    data: {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      plan_slug: planSlug,
      plan_name: proposal.to.plan_name,
      status: "active",
      stripe_detached: Boolean(
        detachStripe && proposal.from.has_stripe_subscription,
      ),
    },
  };
}

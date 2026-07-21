import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asBoolean, asNumber } from "./helpers";

async function ownerEmailsForTenant(tenantId: string): Promise<string[]> {
  const { data: owners } = await supabaseAdmin
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner");

  const emails: string[] = [];
  for (const row of (owners ?? []).slice(0, 3)) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      if (data.user?.email) emails.push(data.user.email);
    } catch {
      // ignore
    }
  }
  return emails;
}

export { ownerEmailsForTenant };

export function buildTrialFollowupDraft(input: {
  salonName: string;
  trialEndsAt: string | null;
  planName: string | null;
}): string {
  const end = input.trialEndsAt
    ? new Date(input.trialEndsAt).toLocaleDateString("ro-RO")
    : "curând";
  return `Salut! Sunt Maris de la Frizeo.

Trial-ul pentru ${input.salonName}${
    input.planName ? ` (${input.planName})` : ""
  } expiră pe ${end}.

Dacă vrei să continui cu un plan plătit (Pro / Pro+) sau ai nevoie de câteva zile în plus, răspunde-mi pe acest email și te ajut eu.`;
}

/**
 * After daily briefing: who to contact about expiring trials.
 */
export async function trialFollowupsTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const days = Math.min(Math.max(asNumber(args.days) ?? 7, 1), 30);
  const includeDrafts = asBoolean(args.include_drafts, true);
  const today = getTodayInBookingTimezone();
  const until = addDaysToDateString(today, days);

  const { data: trials, error } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "tenant_id, status, trial_ends_at, stripe_subscription_id, plans(name, slug)",
    )
    .eq("status", "trialing")
    .not("trial_ends_at", "is", null)
    .gte("trial_ends_at", today)
    .lte("trial_ends_at", `${until}T23:59:59`)
    .order("trial_ends_at", { ascending: true });

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut încărca trial-urile.",
      error: error.message,
    };
  }

  const rows = trials ?? [];
  if (!rows.length) {
    return {
      ok: true,
      summary: `Niciun trial care expiră în următoarele ${days} zile.`,
      data: { days, followups: [] },
    };
  }

  const tenantIds = [...new Set(rows.map((r) => r.tenant_id))];
  const { data: tenants } = await supabaseAdmin
    .from("tenants")
    .select("id, name, slug, phone")
    .in("id", tenantIds);
  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));

  const followups = [];
  for (const row of rows) {
    const tenant = tenantById.get(row.tenant_id);
    const plan = row.plans as { name?: string; slug?: string } | null;
    const owner_emails = await ownerEmailsForTenant(row.tenant_id);
    const salonName = tenant?.name || "salonul tău";
    const item: Record<string, unknown> = {
      tenant_id: row.tenant_id,
      name: tenant?.name || null,
      slug: tenant?.slug || null,
      phone: tenant?.phone || null,
      trial_ends_at: row.trial_ends_at,
      plan_name: plan?.name || null,
      plan_slug: plan?.slug || null,
      has_stripe: Boolean(row.stripe_subscription_id),
      owner_emails,
      urgent:
        String(row.trial_ends_at || "").slice(0, 10) <=
        addDaysToDateString(today, 3),
    };
    if (includeDrafts) {
      item.message_draft = buildTrialFollowupDraft({
        salonName,
        trialEndsAt: row.trial_ends_at,
        planName: plan?.name || null,
      });
    }
    followups.push(item);
  }

  const urgent = followups.filter((f) => f.urgent).length;

  return {
    ok: true,
    summary: `${followups.length} trial-uri de follow-up în ${days} zile (${urgent} urgente ≤3 zile). Include email owner${
      includeDrafts ? " + draft mesaj" : ""
    }. Pentru trimitere reală folosește send_trial_followup.`,
    data: { days, followups, urgent_count: urgent },
  };
}

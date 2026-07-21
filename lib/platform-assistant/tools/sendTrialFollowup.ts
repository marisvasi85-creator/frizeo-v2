import { sendEmail } from "@/lib/email/email";
import { trialFollowupTemplate } from "@/lib/email/templates/trial-followup";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asBoolean, asNumber, asString, resolveTenant } from "./helpers";
import { buildTrialFollowupDraft, ownerEmailsForTenant } from "./trialFollowups";

type FollowupTarget = {
  tenant_id: string;
  name: string;
  slug: string;
  trial_ends_at: string | null;
  plan_name: string | null;
  owner_emails: string[];
  message: string;
};

async function loadTargets(args: Record<string, unknown>): Promise<{
  targets: FollowupTarget[];
  error?: PlatformToolResult;
}> {
  const customBody = asString(args.body) || asString(args.message);
  const hasLookup =
    Boolean(asString(args.tenant_id)) ||
    Boolean(asString(args.slug)) ||
    Boolean(asString(args.name)) ||
    Boolean(asString(args.tenant_name));

  if (hasLookup) {
    const resolved = await resolveTenant(args);
    if (resolved.ambiguous) {
      return {
        targets: [],
        error: {
          ok: false,
          summary: "Mai multe saloane potrivesc. Specifică slug sau tenant_id.",
          error: "ambiguous",
          data: { candidates: resolved.ambiguous },
        },
      };
    }
    if (!resolved.tenant) {
      return {
        targets: [],
        error: {
          ok: false,
          summary: "Salonul nu a fost găsit.",
          error: "not_found",
        },
      };
    }

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("trial_ends_at, plans(name, slug)")
      .eq("tenant_id", resolved.tenant.id)
      .maybeSingle();
    const plan = sub?.plans as { name?: string; slug?: string } | null;
    const owner_emails = await ownerEmailsForTenant(resolved.tenant.id);
    const message =
      customBody ||
      buildTrialFollowupDraft({
        salonName: resolved.tenant.name,
        trialEndsAt: sub?.trial_ends_at || null,
        planName: plan?.name || null,
      });

    return {
      targets: [
        {
          tenant_id: resolved.tenant.id,
          name: resolved.tenant.name,
          slug: resolved.tenant.slug,
          trial_ends_at: sub?.trial_ends_at || null,
          plan_name: plan?.name || null,
          owner_emails,
          message,
        },
      ],
    };
  }

  const days = Math.min(Math.max(asNumber(args.days) ?? 7, 1), 30);
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
      targets: [],
      error: {
        ok: false,
        summary: "Nu am putut încărca trial-urile.",
        error: error.message,
      },
    };
  }

  const rows = trials ?? [];
  if (!rows.length) {
    return { targets: [] };
  }

  const tenantIds = [...new Set(rows.map((r) => r.tenant_id))];
  const { data: tenants } = await supabaseAdmin
    .from("tenants")
    .select("id, name, slug")
    .in("id", tenantIds);
  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));

  const targets: FollowupTarget[] = [];
  for (const row of rows) {
    const tenant = tenantById.get(row.tenant_id);
    if (!tenant) continue;
    const plan = row.plans as { name?: string; slug?: string } | null;
    const owner_emails = await ownerEmailsForTenant(row.tenant_id);
    targets.push({
      tenant_id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      trial_ends_at: row.trial_ends_at,
      plan_name: plan?.name || null,
      owner_emails,
      message:
        customBody ||
        buildTrialFollowupDraft({
          salonName: tenant.name,
          trialEndsAt: row.trial_ends_at,
          planName: plan?.name || null,
        }),
    });
  }

  return { targets };
}

/**
 * Send real trial follow-up emails (SMTP). Confirmation required.
 */
export async function sendTrialFollowupTool(
  args: Record<string, unknown>,
  ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const confirmed = asBoolean(args.confirmed);
  const onlyWithEmail = asBoolean(args.only_with_email, true);

  const loaded = await loadTargets(args);
  if (loaded.error) return loaded.error;

  let targets = loaded.targets;
  if (onlyWithEmail) {
    targets = targets.filter((t) => t.owner_emails.length > 0);
  }

  if (!targets.length) {
    return {
      ok: true,
      summary:
        "Niciun destinatar pentru follow-up (fără trial în fereastră sau fără email owner).",
      data: { targets: [], sent: [] },
    };
  }

  const missingEmail = loaded.targets.filter((t) => !t.owner_emails.length);
  const proposal = {
    count: targets.length,
    recipients: targets.map((t) => ({
      tenant_id: t.tenant_id,
      name: t.name,
      slug: t.slug,
      owner_emails: t.owner_emails,
      trial_ends_at: t.trial_ends_at,
      preview: t.message.slice(0, 180) + (t.message.length > 180 ? "…" : ""),
    })),
    skipped_no_email: missingEmail.map((t) => ({
      name: t.name,
      slug: t.slug,
    })),
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: trimit ${targets.length} email(uri) de follow-up trial.`,
      data: {
        needs_confirmation: true,
        action: "send_trial_followup",
        proposal,
        instruct_user:
          "Cere confirmare. Dacă acceptă, apelează send_trial_followup din nou cu confirmed=true (aceiași parametri).",
      },
    };
  }

  if (!process.env.EMAIL_HOST || !process.env.EMAIL_FROM) {
    return {
      ok: false,
      summary:
        "Email neconfigurat (EMAIL_HOST / EMAIL_FROM). Nu pot trimite follow-up-uri.",
      error: "email_not_configured",
    };
  }

  const sent: Array<{
    tenant_id: string;
    name: string;
    to: string[];
    ok: boolean;
    error?: string;
  }> = [];

  for (const target of targets) {
    const trialEndsLabel = target.trial_ends_at
      ? new Date(target.trial_ends_at).toLocaleDateString("ro-RO")
      : "curând";
    const html = trialFollowupTemplate({
      salonName: target.name,
      trialEndsLabel,
      planName: target.plan_name,
      bodyText: target.message,
    });

    const errors: string[] = [];
    for (const to of target.owner_emails) {
      try {
        await sendEmail({
          to,
          subject: `Frizeo — trial ${target.name} expiră pe ${trialEndsLabel}`,
          html,
        });
      } catch (err) {
        errors.push(
          `${to}: ${err instanceof Error ? err.message : "send failed"}`,
        );
      }
    }

    sent.push({
      tenant_id: target.tenant_id,
      name: target.name,
      to: target.owner_emails,
      ok: errors.length === 0,
      error: errors.length ? errors.join("; ") : undefined,
    });
  }

  const okCount = sent.filter((s) => s.ok).length;
  const failCount = sent.length - okCount;

  console.info("platform send_trial_followup", {
    by: ctx.email,
    userId: ctx.userId,
    okCount,
    failCount,
    at: new Date().toISOString(),
  });

  return {
    ok: failCount === 0,
    summary:
      failCount === 0
        ? `Am trimis ${okCount} email(uri) de follow-up trial.`
        : `Trimise ${okCount}, eșuate ${failCount}. Vezi detalii în rezultat.`,
    data: { sent, proposal_count: targets.length },
    error: failCount ? "partial_failure" : undefined,
  };
}

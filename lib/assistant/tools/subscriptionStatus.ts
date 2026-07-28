import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";

export async function subscriptionStatusTool(
  _args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const [plan, subRes, activeRes, pendingRes] = await Promise.all([
    getCurrentPlan(ctx.tenantId),
    supabaseAdmin
      .from("subscriptions")
      .select("status, trial_ends_at, stripe_subscription_id")
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle(),
    supabaseAdmin
      .from("barbers")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("active", true),
    supabaseAdmin
      .from("barber_invitations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("accepted", false),
  ]);

  if (!plan && !subRes.data) {
    return {
      ok: true,
      summary: "Nu există abonament înregistrat.",
      data: { status: "unknown" },
    };
  }

  const status = subRes.data?.status ?? plan?.status ?? "unknown";
  const trialEndsAt =
    typeof (subRes.data?.trial_ends_at ?? plan?.trial_ends_at) === "string"
      ? ((subRes.data?.trial_ends_at ?? plan?.trial_ends_at) as string)
      : null;
  const isAppTrial =
    status === "trialing" && !subRes.data?.stripe_subscription_id;

  let trialDaysLeft: number | null = null;
  if (trialEndsAt) {
    trialDaysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
  }

  const maxBarbers =
    typeof (plan as { max_barbers?: number | null } | null)?.max_barbers ===
      "number" ||
    (plan as { max_barbers?: number | null } | null)?.max_barbers === null
      ? ((plan as { max_barbers?: number | null }).max_barbers ?? null)
      : null;

  const activeBarbers = activeRes.count ?? 0;
  const pendingInvites = pendingRes.count ?? 0;
  const ownerActsAsBarber = ctx.actsAsBarber ?? Boolean(ctx.barberId);
  const seatsLeft =
    maxBarbers === null ? null : Math.max(0, maxBarbers - activeBarbers);

  const guidance = {
    invites_unlimited: true,
    invites_note:
      "Poți trimite oricâte invitații. Locurile se ocupă doar când un frizer e activ (acceptat/activat).",
    change_owner_role_path: "/admin/barbers",
    change_owner_role_note:
      "Owner: în Frizeri → „Rolul tău: frizer sau doar admin?”. Activarea ca frizer ocupă 1 loc; doar-admin eliberează locul.",
    after_trial_if_unpaid:
      "Fără plată trece pe Free (1 frizer activ). Datele nu se șterg; frizerii peste limită rămân, dar nu pot fi toți activi până upgrade/reducere.",
    after_trial_choose_pro:
      "Pro = 1 frizer activ. Dacă ai mai mulți activi, trebuie să dezactivezi până la 1 înainte de activarea Pro.",
    after_trial_choose_pro_plus:
      "Pro+ = până la 3 frizeri activi. Dacă ești deja pe trial Pro+ cu ≤3 activi, nu schimbi nimic la echipă.",
    owner_seat_note: ownerActsAsBarber
      ? "Owner e frizer activ → ocupă 1 loc din maxim."
      : "Owner e doar administrator → ocupă 0 locuri; locurile sunt pentru frizerii invitați/activi.",
  };

  const data = {
    plan_name: (plan as { name?: string } | null)?.name ?? null,
    plan_slug: (plan as { slug?: string } | null)?.slug ?? null,
    status,
    is_app_trial: isAppTrial,
    trial_ends_at: trialEndsAt,
    trial_days_left: trialDaysLeft,
    max_active_barbers: maxBarbers,
    active_barbers: activeBarbers,
    pending_invites: pendingInvites,
    seats_left: seatsLeft,
    owner_acts_as_barber: ownerActsAsBarber,
    guidance,
  };

  const seats =
    maxBarbers === null
      ? `${activeBarbers} frizeri activi (nelimitat / custom)`
      : `${activeBarbers} / ${maxBarbers} frizeri activi (${seatsLeft} locuri libere)`;

  const trialBit = isAppTrial
    ? ` Trial Pro+: ${trialDaysLeft ?? "?"} zile rămase.`
    : "";

  return {
    ok: true,
    summary: `Plan: ${data.plan_name ?? "necunoscut"} (${status}). ${seats}. Invitații nelimitate (${pendingInvites} în așteptare).${trialBit}`,
    data,
  };
}

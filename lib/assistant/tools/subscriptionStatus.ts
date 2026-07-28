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
  const slotsUsed = activeBarbers + pendingInvites;
  const invitesLeft =
    maxBarbers === null ? null : Math.max(0, maxBarbers - slotsUsed);
  const inviteCapacityIfOwnerBarber =
    maxBarbers === null ? null : Math.max(0, maxBarbers - 1);
  const inviteCapacityIfAdminOnly = maxBarbers;

  const guidance = {
    invites_unlimited: maxBarbers === null,
    invites_note:
      maxBarbers === null
        ? "Plan Custom: locuri configurabile."
        : ownerActsAsBarber
          ? `Owner e și frizer (1 loc). Pe planul curent mai poate invita maxim ${inviteCapacityIfOwnerBarber} (dacă are locuri libere). Acum: ${invitesLeft} invitații rămase.`
          : `Owner e doar administrator (0 locuri). Pe planul curent poate invita până la ${inviteCapacityIfAdminOnly}. Acum: ${invitesLeft} invitații rămase.`,
    change_owner_role_path: "/admin/barbers",
    change_owner_role_note:
      "Owner: în Frizeri → „Rolul tău: frizer sau doar admin?”. Activarea ca frizer ocupă 1 loc; doar-admin eliberează locul.",
    at_invite_limit_message:
      invitesLeft === 0 && maxBarbers !== null
        ? `Ai atins limita de ${maxBarbers} frizeri (activi + invitații). Dezactivează un frizer, șterge o invitație, sau upgrade la Custom.`
        : null,
    after_trial_if_unpaid:
      "Fără plată trece pe Free (1 frizer activ). Datele nu se șterg; frizerii peste limită rămân, dar nu pot fi toți activi până upgrade/reducere.",
    after_trial_choose_pro:
      "Pro = 1 frizer activ. Dacă ai mai mulți activi, trebuie să dezactivezi până la 1 înainte de activarea Pro.",
    after_trial_choose_pro_plus:
      "Pro+ = până la 3 frizeri. Dacă ești deja pe trial Pro+ cu ≤3, nu schimbi nimic la echipă.",
    owner_seat_note: ownerActsAsBarber
      ? "Owner e frizer activ → ocupă 1 loc din maxim; pe Pro+/trial mai rămân 2 pentru invitații."
      : "Owner e doar administrator → ocupă 0 locuri; pe Pro+/trial poate invita până la 3.",
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
    slots_used_for_invites: slotsUsed,
    invites_left: invitesLeft,
    owner_acts_as_barber: ownerActsAsBarber,
    guidance,
  };

  const seats =
    maxBarbers === null
      ? `${activeBarbers} frizeri activi (nelimitat / custom)`
      : `${activeBarbers} / ${maxBarbers} frizeri activi; ${invitesLeft} invitații rămase (${pendingInvites} pending)`;

  const trialBit = isAppTrial
    ? ` Trial Pro+: ${trialDaysLeft ?? "?"} zile rămase.`
    : "";

  return {
    ok: true,
    summary: `Plan: ${data.plan_name ?? "necunoscut"} (${status}). ${seats}.${trialBit}`,
    data,
  };
}

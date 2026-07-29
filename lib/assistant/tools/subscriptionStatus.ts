import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
import { planAllowsBarberInvites } from "@/lib/billing/plans";
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

  const planSlug = (plan as { slug?: string } | null)?.slug ?? null;
  const planName = (plan as { name?: string } | null)?.name ?? null;
  const activeBarbers = activeRes.count ?? 0;
  const pendingInvites = pendingRes.count ?? 0;
  const ownerActsAsBarber = ctx.actsAsBarber ?? Boolean(ctx.barberId);
  const invitesAllowed = planAllowsBarberInvites({
    slug: planSlug,
    status,
  });
  const slotsUsed = activeBarbers + pendingInvites;
  const invitesLeft = !invitesAllowed
    ? 0
    : maxBarbers === null
      ? null
      : Math.max(0, maxBarbers - slotsUsed);

  const guidance = {
    invites_allowed: invitesAllowed,
    invites_unlimited: invitesAllowed && maxBarbers === null,
    invites_note: !invitesAllowed
      ? `Planul ${planName ?? "Free/Pro"} nu include invitații. Un singur frizer. Pentru echipă: Pro+ sau Custom.`
      : maxBarbers === null
        ? "Plan Custom: locuri configurabile."
        : ownerActsAsBarber
          ? `Owner e și frizer (1 loc). Pe Pro+/trial mai poate invita maxim ${Math.max(0, maxBarbers - 1)}. Acum: ${invitesLeft} invitații rămase.`
          : `Owner e doar administrator (0 locuri). Pe Pro+/trial poate invita până la ${maxBarbers}. Acum: ${invitesLeft} invitații rămase.`,
    change_owner_role_path: "/admin/barbers#owner-role",
    change_owner_role_note:
      "Schimbarea rolului (frizer ↔ doar admin) se face DOAR în Frizeri, jos pe pagină: „Opțiune: apari și ca frizer”. Nu e pe Dashboard. Activarea ca frizer ocupă 1 loc; dezactivarea eliberează locul.",
    at_invite_limit_message:
      invitesAllowed && invitesLeft === 0 && maxBarbers !== null
        ? `Ai atins limita de ${maxBarbers} frizeri (activi + invitații). Dezactivează un frizer, șterge o invitație, sau upgrade la Custom.`
        : null,
    after_trial_choose_pro:
      activeBarbers <= 1
        ? "Poți alege Pro fără modificări (ai ≤1 frizer activ). Pro = 1 frizer, fără invitații."
        : `Ai ${activeBarbers} frizeri activi. Pentru Pro trebuie să dezactivezi până la 1 înainte de checkout. Pro = fără invitații.`,
    after_trial_choose_pro_plus:
      activeBarbers <= 3
        ? "Poți alege Pro+ fără modificări (ai ≤3 frizeri activi)."
        : `Ai ${activeBarbers} frizeri activi. Pentru Pro+ trebuie ≤3 activi.`,
    after_trial_if_unpaid:
      "Fără plată trece pe Free (1 frizer activ, fără invitații). Datele nu se șterg.",
    trial_invite_warning: isAppTrial
      ? "Pe trial, frizerul invitat e acoperit din abonamentul salonului. Dacă după trial alegi Pro (1 frizer), frizerii în plus trebuie dezactivați."
      : null,
    owner_seat_note: !invitesAllowed
      ? "Pe Free/Pro nu există invitații echipă."
      : ownerActsAsBarber
        ? "Owner e frizer activ → ocupă 1 loc; pe Pro+/trial mai rămân 2 pentru invitații."
        : "Owner e doar administrator → ocupă 0 locuri; pe Pro+/trial poate invita până la 3.",
  };

  const data = {
    plan_name: planName,
    plan_slug: planSlug,
    status,
    is_app_trial: isAppTrial,
    trial_ends_at: trialEndsAt,
    trial_days_left: trialDaysLeft,
    max_active_barbers: maxBarbers,
    active_barbers: activeBarbers,
    pending_invites: pendingInvites,
    invites_allowed: invitesAllowed,
    slots_used_for_invites: slotsUsed,
    invites_left: invitesLeft,
    owner_acts_as_barber: ownerActsAsBarber,
    can_choose_pro_without_changes: activeBarbers <= 1,
    guidance,
  };

  const seats = !invitesAllowed
    ? `${activeBarbers} / ${maxBarbers ?? 1} frizeri activi (fără invitații pe acest plan)`
    : maxBarbers === null
      ? `${activeBarbers} frizeri activi (nelimitat / custom)`
      : `${activeBarbers} / ${maxBarbers} frizeri activi; ${invitesLeft} invitații rămase (${pendingInvites} pending)`;

  const trialBit = isAppTrial
    ? planSlug === "pro"
      ? ` Trial Pro: ${trialDaysLeft ?? "?"} zile rămase (1 frizer, fără invitații).`
      : ` Trial Pro+: ${trialDaysLeft ?? "?"} zile rămase.`
    : "";

  return {
    ok: true,
    summary: `Plan: ${data.plan_name ?? "necunoscut"} (${status}). ${seats}.${trialBit}`,
    data,
  };
}

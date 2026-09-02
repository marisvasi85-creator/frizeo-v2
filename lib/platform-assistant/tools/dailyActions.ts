import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asNumber } from "./helpers";
import { loadGrowthSnapshot } from "../growth/snapshot";
import { inferInactiveReason } from "../growth/reasons";
import { getAppUrl } from "@/lib/app/getAppUrl";

type Action = {
  priority: number;
  type: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  why: string;
  do_this: string;
};

export async function dailyActionsTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const limit = Math.min(Math.max(asNumber(args.limit) ?? 12, 5), 25);
  const loaded = await loadGrowthSnapshot();
  if (loaded.error && loaded.tenants.length === 0) {
    return {
      ok: false,
      summary: "Nu am putut construi lista de acțiuni.",
      error: loaded.error,
    };
  }

  const actions: Action[] = [];
  const { tenants } = loaded;

  for (const t of tenants) {
    if (t.subscription_status === "past_due") {
      actions.push({
        priority: 5,
        type: "past_due",
        name: t.name,
        slug: t.slug,
        email: t.owner_email,
        phone: t.phone,
        why: "Plată restantă — risc de churn.",
        do_this: "Verifică Stripe / scrie-i azi. Nu aștepta reminder-ul automat.",
      });
    }
  }

  for (const t of tenants.filter((x) => x.trial_ending_soon && x.bookings_ever > 0)) {
    actions.push({
      priority: 10,
      type: "trial_expiring_active",
      name: t.name,
      slug: t.slug,
      email: t.owner_email,
      phone: t.phone,
      why: `Trial expiră ${String(t.trial_ends_at || "").slice(0, 10)} și are ${t.bookings_ever} programări.`,
      do_this:
        "Email de conversie (Pro / Pro+). Dacă ezită, 7 zile extra cu extend_trial (cu confirmare).",
    });
  }

  for (const t of tenants.filter((x) => x.trial_ending_soon && x.bookings_ever === 0)) {
    actions.push({
      priority: 20,
      type: "trial_expiring_idle",
      name: t.name,
      slug: t.slug,
      email: t.owner_email,
      phone: t.phone,
      why: "Trial aproape expirat, zero programări.",
      do_this:
        "Nu vinde Pro. Ajută-l să-și pună prima rezervare (link public + un post).",
    });
  }

  for (const t of tenants.filter((x) => x.trial_expired)) {
    const inferred = inferInactiveReason(t);
    actions.push({
      priority: 30,
      type: "trial_expired",
      name: t.name,
      slug: t.slug,
      email: t.owner_email,
      phone: t.phone,
      why: inferred.reason,
      do_this: inferred.suggestion,
    });
  }

  for (const t of tenants.filter(
    (x) =>
      x.bookings_ever === 0 &&
      x.onboarded &&
      !x.trial_ending_soon &&
      !x.trial_expired,
  )) {
    actions.push({
      priority: 40,
      type: "abandoned_activation",
      name: t.name,
      slug: t.slug,
      email: t.owner_email,
      phone: t.phone,
      why: "Setup făcut, încă nicio programare.",
      do_this: "Follow-up „prima programare”: trimite-ți link-ul, facem o rezervare test.",
    });
  }

  for (const t of tenants.filter(
    (x) =>
      !x.last_login_at ||
      ((x.days_since_login ?? 0) >= 14 && x.bookings_last_30d === 0),
  )) {
    if (actions.some((a) => a.slug === t.slug)) continue;
    const inferred = inferInactiveReason(t);
    actions.push({
      priority: 50,
      type: "inactive",
      name: t.name,
      slug: t.slug,
      email: t.owner_email,
      phone: t.phone,
      why: inferred.reason,
      do_this: inferred.suggestion,
    });
  }

  const reviewReady = tenants
    .filter(
      (t) =>
        t.is_paid &&
        t.bookings_last_30d >= 8 &&
        (t.days_since_login ?? 99) <= 7 &&
        t.health_issues.length === 0,
    )
    .slice(0, 3);

  for (const t of reviewReady) {
    actions.push({
      priority: 70,
      type: "review",
      name: t.name,
      slug: t.slug,
      email: t.owner_email,
      phone: t.phone,
      why: `${t.bookings_last_30d} programări / 30 zile, login recent, pe plan plătit.`,
      do_this: `Cere review: ${getAppUrl()}/review (draft din review_candidates).`,
    });
  }

  actions.sort((a, b) => a.priority - b.priority);
  const top = actions.slice(0, limit);

  const byType: Record<string, number> = {};
  for (const a of actions) {
    byType[a.type] = (byType[a.type] || 0) + 1;
  }

  const headline = top[0]
    ? `Azi începe cu ${top[0].name}: ${top[0].why}`
    : "Nimic urgent — cere un review unui salon activ sau salută saloanele noi.";

  return {
    ok: true,
    summary: `De făcut azi: ${top.length} acțiuni (din ${actions.length}). ${headline}`,
    data: {
      date: loaded.today,
      counts: byType,
      actions: top,
      truncated: actions.length > top.length,
    },
  };
}

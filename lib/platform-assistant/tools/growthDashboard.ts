import { getTodayInBookingTimezone } from "@/lib/bookings/bookingTimezone";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asNumber } from "./helpers";
import { inDateWindow, loadGrowthSnapshot } from "../growth/snapshot";
import { windowFromDays } from "../growth/reasons";
import type { GrowthTenant } from "../growth/types";

function countWhere(
  tenants: GrowthTenant[],
  pred: (t: GrowthTenant) => boolean,
): number {
  return tenants.filter(pred).length;
}

function delta(current: number, previous: number): string {
  const d = current - previous;
  if (d === 0) return "la fel ca perioada anterioară";
  return d > 0 ? `+${d} vs perioada anterioară` : `${d} vs perioada anterioară`;
}

export async function growthDashboardTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const days = Math.min(Math.max(asNumber(args.days) ?? 7, 1), 90);
  const loaded = await loadGrowthSnapshot();
  if (loaded.error && loaded.tenants.length === 0) {
    return {
      ok: false,
      summary: "Nu am putut încărca datele de growth.",
      error: loaded.error,
    };
  }

  const today = loaded.today || getTodayInBookingTimezone();
  const { from, to, prevFrom, prevTo } = windowFromDays(today, days);
  const { tenants, conversions } = loaded;

  const newSalons = tenants.filter((t) =>
    inDateWindow(t.created_at, from, to),
  );
  const prevNew = countWhere(tenants, (t) =>
    inDateWindow(t.created_at, prevFrom, prevTo),
  );
  const onboardedNew = newSalons.filter((t) => t.onboarded).length;
  const firstBookings = tenants.filter((t) =>
    inDateWindow(t.first_booking_at, from, to),
  );
  const prevFirst = countWhere(tenants, (t) =>
    inDateWindow(t.first_booking_at, prevFrom, prevTo),
  );

  const conversionsNow = conversions.filter(
    (c) =>
      c.conversion_type === "subscription_started" &&
      inDateWindow(c.occurred_at, from, to),
  );
  const prevConversions = conversions.filter(
    (c) =>
      c.conversion_type === "subscription_started" &&
      inDateWindow(c.occurred_at, prevFrom, prevTo),
  ).length;

  const trialEnded = tenants.filter((t) =>
    inDateWindow(t.trial_ends_at, from, to),
  );
  const trialActive = tenants.filter((t) => t.is_trialing);
  const pastDue = tenants.filter((t) => t.subscription_status === "past_due");
  const activeUsers = tenants.filter((t) =>
    inDateWindow(t.last_login_at, from, to),
  );
  const zeroBookings = tenants.filter((t) => t.bookings_ever === 0);
  const abandonedSetup = tenants.filter(
    (t) => t.bookings_ever === 0 && t.onboarded,
  );
  const paid = tenants.filter((t) => t.is_paid);

  const recommendations: string[] = [];
  const endingSoon = tenants.filter((t) => t.trial_ending_soon);
  const endingSoonWithBookings = endingSoon.filter((t) => t.bookings_ever > 0);
  const expired = tenants.filter((t) => t.trial_expired);

  if (endingSoonWithBookings.length > 0) {
    recommendations.push(
      `Conversie: ${endingSoonWithBookings.length} trial-uri cu programări expiră în ≤3 zile — sună / scrie azi, nu mâine.`,
    );
  }
  if (endingSoon.length - endingSoonWithBookings.length > 0) {
    recommendations.push(
      `Activare: ${endingSoon.length - endingSoonWithBookings.length} trial-uri expiră fără nicio programare — ajută-i cu link-ul public.`,
    );
  }
  if (expired.length > 0) {
    recommendations.push(
      `Win-back: ${expired.length} trial-uri expirate încă pe trialing — oferă prelungire sau întreabă de ce nu au continuat.`,
    );
  }
  if (pastDue.length > 0) {
    recommendations.push(
      `Retenție: ${pastDue.length} past_due — verifică plata înainte să-i pierzi.`,
    );
  }
  if (abandonedSetup.length > 0) {
    recommendations.push(
      `Onboarding: ${abandonedSetup.length} saloane setup-uite, zero programări — follow-up „prima rezervare”.`,
    );
  }
  if (conversionsNow.length === 0 && trialActive.length > 0) {
    recommendations.push(
      `Nicio conversie trial → Pro în ${days} zile. Prioritizează trial-urile cu programări, nu volumele moarte.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Nimic critic. Ține ritmul: salută saloanele noi și cere review celor activi.",
    );
  }

  const data = {
    period: { days, from, to, previous: { from: prevFrom, to: prevTo } },
    metrics: {
      new_salons: newSalons.length,
      new_salons_delta: newSalons.length - prevNew,
      onboarded_of_new: onboardedNew,
      first_bookings: firstBookings.length,
      first_bookings_delta: firstBookings.length - prevFirst,
      trial_active: trialActive.length,
      trial_ended_in_period: trialEnded.length,
      conversions_trial_to_pro: conversionsNow.length,
      conversions_delta: conversionsNow.length - prevConversions,
      past_due: pastDue.length,
      active_owners: activeUsers.length,
      paid_now: paid.length,
      zero_bookings_ever: zeroBookings.length,
    },
    new_salons: newSalons.slice(0, 12).map((t) => ({
      name: t.name,
      slug: t.slug,
      owner_email: t.owner_email,
      onboarded: t.onboarded,
      first_booking: Boolean(t.first_booking_at),
    })),
    conversions: conversionsNow.slice(0, 12).map((c) => ({
      tenant_id: c.tenant_id,
      occurred_at: c.occurred_at,
      plan_slug: c.plan_slug,
      name:
        tenants.find((t) => t.tenant_id === c.tenant_id)?.name || null,
    })),
    recommendations,
    note:
      "Signup-ul Frizeo pune servicii + program default. „Onboarding finalizat” = login real + frizer + servicii + program. Conversiile Pro vin din marketing_conversions (subscription_started).",
  };

  const summary = [
    `Growth ${from} → ${to}:`,
    `${newSalons.length} saloane noi (${delta(newSalons.length, prevNew)}),`,
    `${onboardedNew}/${newSalons.length} onboardate,`,
    `${firstBookings.length} prime programări (${delta(firstBookings.length, prevFirst)}),`,
    `${trialActive.length} trial active, ${trialEnded.length} trial-uri care s-au încheiat în fereastră,`,
    `${conversionsNow.length} conversii trial → Pro (${delta(conversionsNow.length, prevConversions)}),`,
    `${pastDue.length} past_due, ${activeUsers.length} owneri activi.`,
    `Acțiuni: ${recommendations.slice(0, 2).join(" ")}`,
  ].join(" ");

  return { ok: true, summary, data };
}

import { addDaysToDateString } from "@/lib/bookings/bookingTimezone";
import type { GrowthFilter, GrowthTenant } from "./types";

export function matchesInactiveFilter(
  tenant: GrowthTenant,
  filter: GrowthFilter | null,
  noLoginDays: number,
): boolean {
  if (!filter) {
    return (
      tenant.bookings_ever === 0 ||
      !tenant.last_login_at ||
      (tenant.days_since_login ?? 0) >= noLoginDays ||
      !tenant.has_services ||
      !tenant.has_working_schedule ||
      tenant.trial_expired
    );
  }

  switch (filter) {
    case "zero_bookings":
      return tenant.bookings_ever === 0;
    case "no_login":
      return (
        !tenant.last_login_at ||
        (tenant.days_since_login ?? 0) >= noLoginDays
      );
    case "no_services":
      return !tenant.has_services;
    case "no_schedule":
      return !tenant.has_working_schedule;
    case "trial_ending_soon":
      return tenant.trial_ending_soon;
    case "trial_expired":
      return tenant.trial_expired;
    default:
      return false;
  }
}

export function inferInactiveReason(tenant: GrowthTenant): {
  reason: string;
  suggestion: string;
  priority: number;
} {
  if (tenant.trial_expired) {
    return {
      reason: "Trial expirat, nu a trecut pe Pro.",
      suggestion:
        "Email scurt: întrebă dacă vrea 7 zile extra sau un call de 10 minute.",
      priority: 10,
    };
  }
  if (tenant.trial_ending_soon && tenant.bookings_ever === 0) {
    return {
      reason: "Trial aproape expirat, fără nicio programare.",
      suggestion:
        "Ajută-l să-și pună link-ul de booking în Instagram / Google. Oferă 7 zile extra dacă răspunde.",
      priority: 20,
    };
  }
  if (tenant.trial_ending_soon) {
    return {
      reason: "Trial aproape expirat; are activitate, dar nu a convertit.",
      suggestion:
        "Follow-up de conversie: Pro vs Pro+, ce îi lipsește, ofertă de ajutor la setup.",
      priority: 25,
    };
  }
  if (!tenant.last_login_at) {
    return {
      reason: "Cont creat, fără login ulterior.",
      suggestion:
        "Mesaj de bun venit + un pas concret (adaugă un serviciu real, copiază link-ul public).",
      priority: 30,
    };
  }
  if (!tenant.has_services) {
    return {
      reason: "Nu are servicii active.",
      suggestion: "Ghidează-l să adauge 2–3 servicii cu preț înainte să expire trial-ul.",
      priority: 35,
    };
  }
  if (!tenant.has_working_schedule) {
    return {
      reason: "Nu are nicio zi de program deschisă.",
      suggestion: "Trimite pașii pentru Program de lucru (L–S). Fără program, clienții nu pot rezerva.",
      priority: 40,
    };
  }
  if (tenant.bookings_ever === 0) {
    return {
      reason: "Setup făcut, zero programări.",
      suggestion:
        "Cere-i să-și trimită link-ul public. Propune o rezervare test și un post de lansare.",
      priority: 50,
    };
  }
  if ((tenant.days_since_login ?? 0) >= 14) {
    return {
      reason: `Nu a mai intrat de ${tenant.days_since_login} zile.`,
      suggestion:
        "Check-in scurt: totul ok? Dacă nu mai folosește Frizeo, întreabă de ce (feedback de churn).",
      priority: 60,
    };
  }
  return {
    reason: "Activitate scăzută.",
    suggestion: "Verifică timeline-ul salonului și propune un follow-up personalizat.",
    priority: 80,
  };
}

export function windowFromDays(today: string, days: number): {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
} {
  const from = addDaysToDateString(today, -(days - 1));
  const prevTo = addDaysToDateString(from, -1);
  const prevFrom = addDaysToDateString(prevTo, -(days - 1));
  return { from, to: today, prevFrom, prevTo };
}

/**
 * Salon lifecycle v2 — stage + next-best-action + frequency rules.
 * SQL RPCs must stay aligned with these thresholds and precedence.
 */

export const LIFECYCLE_STRATEGY_VERSION = 2;

export const LIFECYCLE_STAGES = [
  "signup_incomplete",
  "setup_complete_zero_bookings",
  "manual_booking_only",
  "first_online_booking",
  "building_habit",
  "active",
  "at_risk",
  "trial_ending",
  "free_active",
  "subscribed",
  "churned_or_dormant",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const NEXT_BEST_ACTIONS = [
  "complete_onboarding",
  "check_schedule_services",
  "add_first_manual_booking",
  "share_booking_link",
  "get_first_online_booking",
  "connect_google_calendar",
  "invite_team",
  "request_review",
  "return_to_app",
  "ask_problem",
  "continue_on_free",
  "analyze_upgrade",
  "google_visibility",
  "none",
] as const;

export type NextBestAction = (typeof NEXT_BEST_ACTIONS)[number];

export const NEXT_BEST_ACTION_COPY: Record<
  NextBestAction,
  { title: string; body: string; href: string; cta: string }
> = {
  complete_onboarding: {
    title: "Finalizează onboardingul",
    body: "Serviciile, programul și linkul de booking trebuie să fie gata înainte să apară programări online.",
    href: "/admin/dashboard",
    cta: "Continuă setup-ul",
  },
  check_schedule_services: {
    title: "Verifică programul și serviciile",
    body: "Fără program de lucru și servicii active, clienții nu pot rezerva.",
    href: "/admin/settings",
    cta: "Deschide programul",
  },
  add_first_manual_booking: {
    title: "Adaugă prima programare",
    body: "Pune o programare existentă în agenda Frizeo sau trimite linkul unui client pe WhatsApp.",
    href: "/admin/bookings/new",
    cta: "Adaugă programare",
  },
  share_booking_link: {
    title: "Distribuie linkul de booking",
    body: "Agenda e activă. Următorul pas: trimite linkul public clienților.",
    href: "/admin/dashboard#booking-link",
    cta: "Copiază linkul",
  },
  get_first_online_booking: {
    title: "Obține prima programare online",
    body: "Pune linkul în WhatsApp, Instagram sau Google.",
    href: "/admin/dashboard#booking-link",
    cta: "Vezi linkul",
  },
  connect_google_calendar: {
    title: "Conectează Google Calendar",
    body: "După câteva programări, sincronizarea evită orele duble.",
    href: "/admin/profile",
    cta: "Deschide profilul",
  },
  invite_team: {
    title: "Invită echipa",
    body: "Dacă lucrezi cu mai mulți frizeri, fiecare are nevoie de programul lui.",
    href: "/admin/barbers",
    cta: "Invită frizeri",
  },
  request_review: {
    title: "Cere un review",
    body: "Ai destule programări finalizate ca să ceri feedback.",
    href: "/admin/testimonials",
    cta: "Deschide recenziile",
  },
  return_to_app: {
    title: "Revino în aplicație",
    body: "Agenda a fost activă, apoi s-a oprit. Un login e suficient ca să reiei.",
    href: "/admin/bookings",
    cta: "Deschide programările",
  },
  ask_problem: {
    title: "Spune-ne ce te-a blocat",
    body: "Dacă setup-ul sau trialul nu s-au potrivit, putem ajuta punctual.",
    href: "/admin/dashboard",
    cta: "Deschide dashboard-ul",
  },
  continue_on_free: {
    title: "Poți continua pe Free",
    body: "După trial rămâi în Frizeo, cu 80 de programări pe lună.",
    href: "/admin/billing",
    cta: "Vezi planul",
  },
  analyze_upgrade: {
    title: "Analizează upgrade-ul",
    body: "Te apropii de limita de 80 de programări pe lună. Upgrade-ul e opțional.",
    href: "/admin/billing",
    cta: "Compară planurile",
  },
  google_visibility: {
    title: "Pune linkul în Google / bio",
    body: "Prima programare online a venit. Următorul pas e vizibilitatea.",
    href: "/admin/dashboard#booking-link",
    cta: "Copiază linkul",
  },
  none: {
    title: "",
    body: "",
    href: "/admin/dashboard",
    cta: "",
  },
};

export const LIFECYCLE_PRIORITY = {
  transactional: 10,
  booking_blocker: 20,
  activation: 30,
  trial_billing: 40,
  winback: 50,
  feature: 60,
  marketing: 70,
} as const;

export const LIFECYCLE_THRESHOLDS = {
  activeMinBookings: 10,
  buildingHabitMinBookings: 2,
  buildingHabitMaxBookings: 9,
  googleCalendarMinBookings: 2,
  reviewMinCompletedBookings: 10,
  valueSummaryBookings: 5,
  atRiskInactiveDays: 14,
  churnedInactiveDays: 45,
  recentActivityDays: 14,
  trialEndingDays: 7,
  freePlanMonthlyLimit: 80,
  upgradeHintMonthlyBookings: 64,
  minHoursBetweenEmails: 48,
  maxEmailsPerDay: 1,
  maxEmailsFirst7Days: 3,
  maxEmails30Days: 5,
} as const;

export const TRANSACTIONAL_AUTOMATION_KEYS = new Set([
  "subscription_activated",
]);

export type LifecycleSettings = {
  enabled: boolean;
  strategy_version: number;
  strategy_started_at: string | null;
  min_hours_between_emails: number;
  max_emails_per_day: number;
  max_emails_first_7_days: number;
  max_emails_30_days: number;
  allow_existing_zero_booking_cohort: boolean;
  test_contact_ids: string[];
  notes: string;
};

export type LifecycleTenantRow = {
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  stage: LifecycleStage;
  next_best_action: NextBestAction;
  recorded_bookings: number;
  online_bookings: number;
  last_activity_at: string | null;
  last_automation_key: string | null;
  last_automation_sent_at: string | null;
  next_eligible_at: string | null;
  outreach_status: string;
  unused_reason: string | null;
  enrolled_at: string;
  contact_email: string | null;
};

export type LifecycleFacts = {
  onboardingComplete: boolean;
  recordedBookings: number;
  completedBookings: number;
  onlineBookings: number;
  manualBookings: number;
  bookingsLast7d: number;
  bookingsLast30d: number;
  monthlyBookings: number;
  hadMeaningfulActivity: boolean;
  googleCalendarConnected: boolean;
  activeBarberCount: number;
  hasBarberSeatsAvailable: boolean;
  isPaid: boolean;
  isTrialing: boolean;
  trialEndsInDays: number | null;
  trialExpired: boolean;
  daysSinceLastActivity: number | null;
  daysSinceLastBooking: number | null;
};

export type LifecycleSnapshot = {
  stage: LifecycleStage;
  nextBestAction: NextBestAction;
  strategyVersion: number;
};

function daysOrInf(days: number | null): number {
  return days == null ? Number.POSITIVE_INFINITY : days;
}

/**
 * Exclusive primary stage. Billing and churn take precedence over the
 * activation ladder so trial/paid messaging is not mixed with beginner tips.
 */
export function resolveLifecycleStage(facts: LifecycleFacts): LifecycleStage {
  if (facts.isPaid) return "subscribed";

  const inactiveDays = daysOrInf(facts.daysSinceLastActivity);
  const bookingGap = daysOrInf(facts.daysSinceLastBooking);
  const idleDays = Math.min(inactiveDays, bookingGap);
  const wasActivated = facts.hadMeaningfulActivity || facts.recordedBookings > 0;

  if (
    wasActivated &&
    idleDays >= LIFECYCLE_THRESHOLDS.churnedInactiveDays
  ) {
    return "churned_or_dormant";
  }

  if (
    wasActivated &&
    facts.recordedBookings >= LIFECYCLE_THRESHOLDS.buildingHabitMinBookings &&
    idleDays >= LIFECYCLE_THRESHOLDS.atRiskInactiveDays
  ) {
    return "at_risk";
  }

  if (
    facts.isTrialing &&
    facts.trialEndsInDays != null &&
    facts.trialEndsInDays >= 0 &&
    facts.trialEndsInDays <= LIFECYCLE_THRESHOLDS.trialEndingDays
  ) {
    return "trial_ending";
  }

  if (facts.trialExpired && !facts.isPaid && wasActivated) {
    return "free_active";
  }

  if (!facts.onboardingComplete) return "signup_incomplete";

  if (facts.recordedBookings <= 0) return "setup_complete_zero_bookings";

  if (facts.onlineBookings <= 0) return "manual_booking_only";

  if (
    facts.recordedBookings >= LIFECYCLE_THRESHOLDS.activeMinBookings &&
    idleDays < LIFECYCLE_THRESHOLDS.atRiskInactiveDays
  ) {
    return "active";
  }

  if (
    facts.recordedBookings >= LIFECYCLE_THRESHOLDS.buildingHabitMinBookings &&
    facts.recordedBookings <= LIFECYCLE_THRESHOLDS.buildingHabitMaxBookings
  ) {
    return "building_habit";
  }

  return "first_online_booking";
}

export function resolveNextBestAction(
  stage: LifecycleStage,
  facts: LifecycleFacts,
): NextBestAction {
  switch (stage) {
    case "signup_incomplete":
      return "complete_onboarding";
    case "setup_complete_zero_bookings":
      return "add_first_manual_booking";
    case "manual_booking_only":
      return "share_booking_link";
    case "first_online_booking":
      if (
        facts.recordedBookings >= LIFECYCLE_THRESHOLDS.googleCalendarMinBookings &&
        !facts.googleCalendarConnected
      ) {
        return "connect_google_calendar";
      }
      return "google_visibility";
    case "building_habit":
      if (facts.activeBarberCount >= 2 && facts.hasBarberSeatsAvailable) {
        return "invite_team";
      }
      if (
        facts.recordedBookings >= LIFECYCLE_THRESHOLDS.googleCalendarMinBookings &&
        !facts.googleCalendarConnected
      ) {
        return "connect_google_calendar";
      }
      if (
        facts.completedBookings >= LIFECYCLE_THRESHOLDS.reviewMinCompletedBookings
      ) {
        return "request_review";
      }
      return "none";
    case "active":
      if (facts.monthlyBookings >= LIFECYCLE_THRESHOLDS.upgradeHintMonthlyBookings) {
        return "analyze_upgrade";
      }
      if (
        facts.completedBookings >= LIFECYCLE_THRESHOLDS.reviewMinCompletedBookings
      ) {
        return "request_review";
      }
      return "none";
    case "at_risk":
      return "return_to_app";
    case "trial_ending":
      if (facts.recordedBookings <= 0) return "ask_problem";
      if (facts.monthlyBookings >= LIFECYCLE_THRESHOLDS.upgradeHintMonthlyBookings) {
        return "analyze_upgrade";
      }
      return "continue_on_free";
    case "free_active":
      if (facts.monthlyBookings >= LIFECYCLE_THRESHOLDS.upgradeHintMonthlyBookings) {
        return "analyze_upgrade";
      }
      return "continue_on_free";
    case "subscribed":
      return "none";
    case "churned_or_dormant":
      return "return_to_app";
    default:
      return "none";
  }
}

export function computeLifecycleSnapshot(
  facts: LifecycleFacts,
): LifecycleSnapshot {
  const stage = resolveLifecycleStage(facts);
  return {
    stage,
    nextBestAction: resolveNextBestAction(stage, facts),
    strategyVersion: LIFECYCLE_STRATEGY_VERSION,
  };
}

export type FrequencyCapInput = {
  isTransactional: boolean;
  sentAt: string[];
  now?: Date;
  contactCreatedAt: string;
  minHoursBetween?: number;
};

export type FrequencyCapResult = {
  ok: boolean;
  reason: string | null;
};

function hoursBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 36e5;
}

export function evaluateLifecycleFrequencyCap(
  input: FrequencyCapInput,
): FrequencyCapResult {
  if (input.isTransactional) return { ok: true, reason: null };

  const now = input.now ?? new Date();
  const minHours =
    input.minHoursBetween ?? LIFECYCLE_THRESHOLDS.minHoursBetweenEmails;
  const sent = input.sentAt
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  const latest = sent[0];
  if (latest && hoursBetween(now, latest) < minHours) {
    return { ok: false, reason: "frequency_min_gap" };
  }

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = sent.filter((date) => date >= startOfDay).length;
  if (sentToday >= LIFECYCLE_THRESHOLDS.maxEmailsPerDay) {
    return { ok: false, reason: "frequency_daily_cap" };
  }

  const createdAt = new Date(input.contactCreatedAt);
  const firstWeekEnd = new Date(createdAt.getTime() + 7 * 24 * 3600 * 1000);
  if (now <= firstWeekEnd) {
    const inFirstWeek = sent.filter((date) => date >= createdAt).length;
    if (inFirstWeek >= LIFECYCLE_THRESHOLDS.maxEmailsFirst7Days) {
      return { ok: false, reason: "frequency_first_7_days" };
    }
  }

  const window30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const in30 = sent.filter((date) => date >= window30).length;
  if (in30 >= LIFECYCLE_THRESHOLDS.maxEmails30Days) {
    return { ok: false, reason: "frequency_30_days" };
  }

  return { ok: true, reason: null };
}

export function pickHighestPriorityAutomation<T extends { priority: number }>(
  eligible: T[],
): T | null {
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => a.priority - b.priority)[0];
}

export function shouldSuppressHistoricalCatchup(input: {
  enrolledAt: string;
  dueAt: string;
  delayMinutes: number;
}): boolean {
  if (input.delayMinutes <= 0) {
    return new Date(input.dueAt) < new Date(input.enrolledAt);
  }
  return new Date(input.dueAt) < new Date(input.enrolledAt);
}

export function automationPriorityForKey(automationKey: string): number {
  if (TRANSACTIONAL_AUTOMATION_KEYS.has(automationKey)) {
    return LIFECYCLE_PRIORITY.transactional;
  }
  if (
    automationKey === "check_schedule_services_after_signup" ||
    automationKey === "incomplete_onboarding_after_signup"
  ) {
    return LIFECYCLE_PRIORITY.booking_blocker;
  }
  if (
    automationKey.startsWith("trial_") ||
    automationKey === "subscription_activated"
  ) {
    return LIFECYCLE_PRIORITY.trial_billing;
  }
  if (
    automationKey.includes("inactive") ||
    automationKey.includes("winback") ||
    automationKey.includes("at_risk") ||
    automationKey.includes("churn")
  ) {
    return LIFECYCLE_PRIORITY.winback;
  }
  if (
    automationKey.includes("google") ||
    automationKey.includes("invite_team")
  ) {
    return LIFECYCLE_PRIORITY.feature;
  }
  if (
    automationKey.includes("welcome") ||
    automationKey.includes("booking") ||
    automationKey.includes("onboarding") ||
    automationKey.includes("setup") ||
    automationKey.includes("activation")
  ) {
    return LIFECYCLE_PRIORITY.activation;
  }
  return LIFECYCLE_PRIORITY.marketing;
}

export function isLifecycleStrategyEnabledFromEnv(): boolean {
  const value = process.env.MARKETING_LIFECYCLE_V2_ENABLED?.trim().toLowerCase();
  return value === "true" || value === "1";
}

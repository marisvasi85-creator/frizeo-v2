import type {
  MarketingAutomationSummary,
  MarketingAutomationTriggerType,
} from "@/lib/frizeo-email/types";

export const AUTOMATION_SCHEDULE_TIMEZONE = "Europe/Bucharest";

export type AutomationJourneyLane =
  | "onboarding"
  | "trial"
  | "countdown"
  | "winback"
  | "paid"
  | "other";

export type ExpectedAutomationSchedule = {
  automation_key: string;
  name: string;
  trigger_type: MarketingAutomationTriggerType;
  delay_minutes: number;
  template_key: string;
  lane: AutomationJourneyLane;
};

/**
 * Canonical day → template map for system automations.
 * Must stay in sync with the Phase 6 / Google-visibility SQL seeds.
 */
export const EXPECTED_AUTOMATION_SCHEDULE: readonly ExpectedAutomationSchedule[] =
  [
    {
      automation_key: "welcome_after_signup",
      name: "Welcome after signup",
      trigger_type: "user_signed_up",
      delay_minutes: 0,
      template_key: "welcome_ready",
      lane: "onboarding",
    },
    {
      automation_key: "check_schedule_services_after_signup",
      name: "Check schedule & services",
      trigger_type: "user_signed_up",
      delay_minutes: 1440,
      template_key: "check_schedule_services",
      lane: "onboarding",
    },
    {
      automation_key: "share_booking_link_after_signup",
      name: "Share booking link",
      trigger_type: "user_signed_up",
      delay_minutes: 2880,
      template_key: "share_booking_link",
      lane: "onboarding",
    },
    {
      automation_key: "google_visibility_after_signup",
      name: "Google visibility after signup",
      trigger_type: "user_signed_up",
      delay_minutes: 4320,
      template_key: "google_visibility",
      lane: "onboarding",
    },
    {
      automation_key: "trial_active_tips",
      name: "Trial active tips",
      trigger_type: "trial_started",
      delay_minutes: 10080,
      template_key: "trial_use_it",
      lane: "trial",
    },
    {
      automation_key: "trial_ending_7_days",
      name: "Trial — 7 days",
      trigger_type: "trial_ending_7_days",
      delay_minutes: 0,
      template_key: "trial_7_days",
      lane: "countdown",
    },
    {
      automation_key: "trial_ending_3_days",
      name: "Trial — 3 days",
      trigger_type: "trial_ending_3_days",
      delay_minutes: 0,
      template_key: "trial_3_days",
      lane: "countdown",
    },
    {
      automation_key: "trial_last_day",
      name: "Trial — last day",
      trigger_type: "trial_last_day",
      delay_minutes: 0,
      template_key: "trial_last_day",
      lane: "countdown",
    },
    {
      automation_key: "trial_expired",
      name: "Trial expired",
      trigger_type: "trial_expired",
      delay_minutes: 1440,
      template_key: "trial_expired",
      lane: "winback",
    },
    {
      automation_key: "trial_expired_7_days",
      name: "Win-back — 7 days",
      trigger_type: "trial_expired",
      delay_minutes: 10080,
      template_key: "winback_7_days",
      lane: "winback",
    },
    {
      automation_key: "subscription_activated",
      name: "Subscription activated",
      trigger_type: "subscription_activated",
      delay_minutes: 0,
      template_key: "subscription_active",
      lane: "paid",
    },
  ] as const;

export const AUTOMATION_LANE_META: Record<
  Exclude<AutomationJourneyLane, "other">,
  { title: string; subtitle: string }
> = {
  onboarding: {
    title: "După signup",
    subtitle: "Delay față de data creării contactului (user_signed_up)",
  },
  trial: {
    title: "Trial activ",
    subtitle: "Delay față de startul trialului (subscriptions.created_at)",
  },
  countdown: {
    title: "Countdown trial",
    subtitle: `Zi calendaristică ${AUTOMATION_SCHEDULE_TIMEZONE} față de trial_ends_at`,
  },
  winback: {
    title: "După expirarea trialului",
    subtitle: "Trimis doar dacă nu există abonament Stripe activ",
  },
  paid: {
    title: "Abonament plătit",
    subtitle: "La activarea subscriptions.status = active + stripe_subscription_id",
  },
};

export function delayDays(minutes: number): number | null {
  if (minutes < 0 || minutes % 1440 !== 0) return null;
  return minutes / 1440;
}

export function automationLane(
  automation: Pick<
    MarketingAutomationSummary,
    "trigger_type" | "automation_key"
  >,
): AutomationJourneyLane {
  if (automation.trigger_type === "user_signed_up") return "onboarding";
  if (automation.trigger_type === "trial_started") return "trial";
  if (
    automation.trigger_type === "trial_ending_7_days" ||
    automation.trigger_type === "trial_ending_3_days" ||
    automation.trigger_type === "trial_last_day"
  ) {
    return "countdown";
  }
  if (automation.trigger_type === "trial_expired") return "winback";
  if (automation.trigger_type === "subscription_activated") return "paid";
  return "other";
}

export function describeAutomationWhen(
  automation: Pick<
    MarketingAutomationSummary,
    "trigger_type" | "delay_minutes" | "automation_key"
  >,
): string {
  const days = delayDays(automation.delay_minutes);

  if (automation.trigger_type === "user_signed_up") {
    if (automation.delay_minutes <= 0) return "Ziua 0 — imediat după signup";
    if (days != null) return `Ziua ${days} după signup`;
    return `${automation.delay_minutes} min după signup`;
  }

  if (automation.trigger_type === "trial_started") {
    if (days != null) return `Ziua ${days} după startul trialului`;
    return `${automation.delay_minutes} min după startul trialului`;
  }

  if (automation.trigger_type === "trial_ending_7_days") {
    return "Când mai sunt exact 7 zile de trial";
  }
  if (automation.trigger_type === "trial_ending_3_days") {
    return "Când mai sunt exact 3 zile de trial";
  }
  if (automation.trigger_type === "trial_last_day") {
    return "În ultima zi de trial";
  }

  if (automation.trigger_type === "trial_expired") {
    if (days != null) {
      return days === 1
        ? "La 1 zi după expirarea trialului"
        : `La ${days} zile după expirarea trialului`;
    }
    return `${automation.delay_minutes} min după expirarea trialului`;
  }

  if (automation.trigger_type === "subscription_activated") {
    return "Imediat după activarea abonamentului plătit";
  }

  if (automation.delay_minutes <= 0) return "Imediat";
  if (days != null) return `${days} zile delay`;
  return `${automation.delay_minutes} min delay`;
}

export type AutomationScheduleMismatch = {
  automation_key: string;
  problem: string;
};

export function findAutomationScheduleMismatches(
  automations: Array<{
    automation_key: string;
    trigger_type: string;
    delay_minutes: number;
    template_key: string | null;
  }>,
): AutomationScheduleMismatch[] {
  const mismatches: AutomationScheduleMismatch[] = [];
  const liveByKey = new Map(
    automations.map((row) => [row.automation_key, row]),
  );

  for (const expected of EXPECTED_AUTOMATION_SCHEDULE) {
    const live = liveByKey.get(expected.automation_key);
    if (!live) {
      mismatches.push({
        automation_key: expected.automation_key,
        problem: `Lipsa automation. Așteptat template ${expected.template_key}.`,
      });
      continue;
    }
    if (live.trigger_type !== expected.trigger_type) {
      mismatches.push({
        automation_key: expected.automation_key,
        problem: `Trigger ${live.trigger_type}, așteptat ${expected.trigger_type}.`,
      });
    }
    if (live.delay_minutes !== expected.delay_minutes) {
      mismatches.push({
        automation_key: expected.automation_key,
        problem: `Delay ${live.delay_minutes} min, așteptat ${expected.delay_minutes}.`,
      });
    }
    if (live.template_key !== expected.template_key) {
      mismatches.push({
        automation_key: expected.automation_key,
        problem: `Template ${live.template_key ?? "—"}, așteptat ${expected.template_key}.`,
      });
    }
  }

  return mismatches;
}

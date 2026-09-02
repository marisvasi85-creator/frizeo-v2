import type {
  MarketingAutomationSummary,
  MarketingAutomationTriggerType,
} from "@/lib/frizeo-email/types";

export const AUTOMATION_SCHEDULE_TIMEZONE = "Europe/Bucharest";

export type AutomationJourneyLane =
  | "onboarding"
  | "activation"
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
 * Must stay in sync with Phase 6 / Google-visibility / activation SQL seeds.
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
      automation_key: "incomplete_onboarding_after_signup",
      name: "Incomplete onboarding",
      trigger_type: "user_signed_up",
      delay_minutes: 1440,
      template_key: "incomplete_onboarding",
      lane: "activation",
    },
    {
      automation_key: "no_first_booking",
      name: "No first booking",
      trigger_type: "user_signed_up",
      delay_minutes: 10080,
      template_key: "no_first_booking",
      lane: "activation",
    },
    {
      automation_key: "google_calendar_after_signup",
      name: "Connect Google Calendar",
      trigger_type: "user_signed_up",
      delay_minutes: 7200,
      template_key: "connect_google_calendar",
      lane: "activation",
    },
    {
      automation_key: "invite_team_after_signup",
      name: "Invite your team",
      trigger_type: "user_signed_up",
      delay_minutes: 10080,
      template_key: "invite_team",
      lane: "activation",
    },
    {
      automation_key: "inactive_account",
      name: "Inactive account",
      trigger_type: "account_inactive",
      delay_minutes: 0,
      template_key: "inactive_account",
      lane: "activation",
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
  activation: {
    title: "Activare / prima programare",
    subtitle:
      "Timp + stare: onboarding, inactivitate, prima programare, Google Calendar, invitații. Worker-ul revalidează înainte de trimitere.",
  },
  trial: {
    title: "Trial activ",
    subtitle: "Delay față de startul trialului (subscriptions.created_at)",
  },
  countdown: {
    title: "Countdown trial",
    subtitle: `Se programează din timp pe data ${AUTOMATION_SCHEDULE_TIMEZONE}; dacă worker-ul a lipsit, se trimite la următorul run (fără a intra pe fereastra mesajului următor)`,
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
  if (automation.automation_key === "google_visibility_after_signup") {
    return "onboarding";
  }
  if (
    automation.trigger_type === "account_inactive" ||
    automation.automation_key === "incomplete_onboarding_after_signup" ||
    automation.automation_key === "no_first_booking" ||
    automation.automation_key === "google_calendar_after_signup" ||
    automation.automation_key === "invite_team_after_signup"
  ) {
    return "activation";
  }
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
    if (automation.automation_key === "incomplete_onboarding_after_signup") {
      return "La 24h după signup, dacă onboardingul e incomplet";
    }
    if (automation.automation_key === "no_first_booking") {
      return "La 7 zile după signup, dacă nu există nicio programare";
    }
    if (automation.automation_key === "google_calendar_after_signup") {
      return "La 5 zile după signup, dacă Google Calendar nu e conectat";
    }
    if (automation.automation_key === "invite_team_after_signup") {
      return "La 7 zile după signup, pe Pro+ cu locuri libere";
    }
    if (automation.delay_minutes <= 0) return "Ziua 0 — imediat după signup";
    if (days != null) return `Ziua ${days} după signup`;
    return `${automation.delay_minutes} min după signup`;
  }

  if (automation.trigger_type === "account_inactive") {
    return "Ultima autentificare mai veche de 7 zile (cooldown 30 zile)";
  }

  if (automation.trigger_type === "trial_started") {
    if (days != null) return `Ziua ${days} după startul trialului`;
    return `${automation.delay_minutes} min după startul trialului`;
  }

  if (automation.trigger_type === "trial_ending_7_days") {
    return "Cu 7 zile înainte de finalul trialului";
  }
  if (automation.trigger_type === "trial_ending_3_days") {
    return "Cu 3 zile înainte de finalul trialului";
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

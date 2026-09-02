"use client";

import Link from "next/link";
import type { MarketingAutomationSummary } from "@/lib/frizeo-email/types";
import {
  AUTOMATION_LANE_META,
  AUTOMATION_SCHEDULE_TIMEZONE,
  automationLane,
  describeAutomationWhen,
  findAutomationScheduleMismatches,
  type AutomationJourneyLane,
} from "@/lib/frizeo-email/automationSchedule";

const LANE_ORDER: Exclude<AutomationJourneyLane, "other">[] = [
  "onboarding",
  "activation",
  "trial",
  "countdown",
  "winback",
  "paid",
];

function delayLabel(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 zi" : `${days} zile`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 oră" : `${hours} ore`;
  }
  return `${minutes} min`;
}

export default function AutomationScheduleSchema({
  automations,
  hrefFor,
}: {
  automations: MarketingAutomationSummary[];
  hrefFor: (path: string) => string;
}) {
  const mismatches = findAutomationScheduleMismatches(automations);
  const grouped = LANE_ORDER.map((lane) => ({
    lane,
    items: automations
      .filter((automation) => automationLane(automation) === lane)
      .sort((a, b) => a.delay_minutes - b.delay_minutes),
  })).filter((group) => group.items.length > 0);

  return (
    <section className="rounded-xl border border-frz-line bg-frz-card p-4 md:p-5 space-y-4">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Schema de trimitere
          </h2>
          <p className="mt-1 text-sm text-frz-ink/60 max-w-3xl">
            Ce template pleacă, în ce zi. Countdown-ul de trial folosește data
            calendaristică {AUTOMATION_SCHEDULE_TIMEZONE}. Worker-ul descoperă
            run-uri, apoi trimite doar dacă condițiile (consent, trial activ,
            neplătit, etc.) sunt încă adevărate.
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-md px-2.5 py-1 text-xs font-medium ${
            mismatches.length === 0
              ? "bg-emerald-500/15 text-emerald-200"
              : "bg-amber-500/15 text-amber-100"
          }`}
        >
          {mismatches.length === 0
            ? "Zile / template OK"
            : `${mismatches.length} nepotriviri`}
        </span>
      </header>

      {mismatches.length > 0 && (
        <ul className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 space-y-1">
          {mismatches.map((row) => (
            <li key={`${row.automation_key}:${row.problem}`}>
              <code className="text-xs">{row.automation_key}</code> —{" "}
              {row.problem}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {grouped.map(({ lane, items }) => {
          const meta = AUTOMATION_LANE_META[lane];
          return (
            <div
              key={lane}
              className="rounded-lg border border-frz-line/70 bg-frz-fog/30 p-3 space-y-3"
            >
              <div>
                <h3 className="font-medium text-sm">{meta.title}</h3>
                <p className="text-xs text-frz-muted mt-0.5">{meta.subtitle}</p>
              </div>
              <ol className="space-y-2">
                {items.map((automation) => (
                  <li key={automation.id}>
                    <Link
                      href={hrefFor(`/automations/${automation.id}`)}
                      className="block rounded-md border border-frz-line/60 bg-frz-card px-3 py-2 hover:bg-frz-fog/80"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {describeAutomationWhen(automation)}
                          </div>
                          <div className="mt-0.5 text-xs text-frz-muted truncate">
                            {automation.name}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                            automation.is_active
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-frz-fog text-frz-ink/50"
                          }`}
                        >
                          {automation.is_active ? "Active" : "Paused"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-frz-ink/60">
                        <span>
                          Delay{" "}
                          <span className="text-frz-ink/80">
                            {delayLabel(automation.delay_minutes)}
                          </span>
                        </span>
                        <span>
                          Template{" "}
                          <code className="text-frz-ink/80">
                            {automation.template_key ||
                              automation.template_name ||
                              "—"}
                          </code>
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}

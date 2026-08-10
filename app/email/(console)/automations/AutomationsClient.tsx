"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MarketingAutomationSummary } from "@/lib/frizeo-email/types";

function delayLabel(minutes: number): string {
  if (minutes <= 0) return "Immediate";
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${minutes} min`;
}

export default function AutomationsClient({
  initialAutomations,
}: {
  initialAutomations: MarketingAutomationSummary[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (automation: MarketingAutomationSummary) => {
    setBusyId(automation.id);
    setError(null);
    try {
      const res = await fetch(`/api/email/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !automation.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nu am putut actualiza statusul.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Automations
        </h1>
        <p className="mt-2 text-sm text-white/55 max-w-3xl">
          System automations Frizeo. Toate pornesc pe <strong>Paused</strong>.
          Activează manual câte una, pe un contact controlat, înainte de
          volume reale.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.04] text-left text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Trigger</th>
              <th className="px-4 py-3 font-medium">Delay</th>
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last run</th>
              <th className="px-4 py-3 font-medium">Sent</th>
              <th className="px-4 py-3 font-medium">Skipped</th>
              <th className="px-4 py-3 font-medium">Failed</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {initialAutomations.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-white/40"
                >
                  Nicio automation. Rulează migrarea Phase 6 pe staging.
                </td>
              </tr>
            ) : (
              initialAutomations.map((automation) => (
                <tr
                  key={automation.id}
                  className="border-t border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{automation.name}</div>
                    <div className="text-xs text-white/40">
                      {automation.automation_key}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/65">
                    {automation.trigger_type}
                  </td>
                  <td className="px-4 py-3 text-white/65">
                    {delayLabel(automation.delay_minutes)}
                  </td>
                  <td className="px-4 py-3 text-white/65">
                    {automation.template_key || automation.template_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs ${
                        automation.is_active
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-white/10 text-white/55"
                      }`}
                    >
                      {automation.is_active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {automation.last_run_at
                      ? new Date(automation.last_run_at).toLocaleString("ro-RO")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{automation.sent_count}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {automation.skipped_count}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {automation.failed_count}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        disabled={pending || busyId === automation.id}
                        onClick={() => toggle(automation)}
                        className="rounded-lg border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
                      >
                        {automation.is_active ? "Pause" : "Activate"}
                      </button>
                      <Link
                        href={`/email/automations/${automation.id}`}
                        className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-black hover:bg-gray-200"
                      >
                        View / Runs
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

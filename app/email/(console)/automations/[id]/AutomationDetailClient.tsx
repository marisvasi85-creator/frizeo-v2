"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type {
  MarketingAutomation,
  MarketingAutomationRun,
  MarketingAutomationRunStatus,
  MarketingConversionStats,
} from "@/lib/frizeo-email/types";

const STATUS_FILTERS: Array<MarketingAutomationRunStatus | "all"> = [
  "all",
  "scheduled",
  "sent",
  "skipped",
  "failed",
];

export default function AutomationDetailClient({
  automation,
  initialRuns,
  templateName,
  templateKey,
  conversions,
}: {
  automation: MarketingAutomation;
  initialRuns: MarketingAutomationRun[];
  templateName: string | null;
  templateKey: string | null;
  conversions: MarketingConversionStats;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<
    MarketingAutomationRunStatus | "all"
  >("all");
  const [isActive, setIsActive] = useState(automation.is_active);
  const [testEmail, setTestEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runs = useMemo(() => {
    if (statusFilter === "all") return initialRuns;
    return initialRuns.filter((run) => run.status === statusFilter);
  }, [initialRuns, statusFilter]);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/email/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed.");
        return;
      }
      setIsActive(Boolean(data.automation?.is_active));
      setMessage(
        data.automation?.is_active
          ? "Automation activată."
          : "Automation pusă pe pause (runs scheduled anulate).",
      );
      startTransition(() => router.refresh());
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/email/automations/${automation.id}/send-test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: testEmail }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Send test failed.");
        return;
      }
      setMessage(
        `Test trimis către ${data.to}. messageId: ${data.messageId}`,
      );
      startTransition(() => router.refresh());
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {automation.name}
          </h1>
          <p className="mt-2 text-sm text-white/55 max-w-2xl">
            {automation.description}
          </p>
          <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <dt className="text-white/40 text-xs">Key</dt>
              <dd>{automation.automation_key}</dd>
            </div>
            <div>
              <dt className="text-white/40 text-xs">Trigger</dt>
              <dd>{automation.trigger_type}</dd>
            </div>
            <div>
              <dt className="text-white/40 text-xs">Delay</dt>
              <dd>{automation.delay_minutes} min</dd>
            </div>
            <div>
              <dt className="text-white/40 text-xs">Template</dt>
              <dd>{templateKey || templateName || "—"}</dd>
            </div>
          </dl>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy || pending}
          className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            isActive
              ? "border border-white/15 text-white/80 hover:bg-white/10"
              : "bg-white text-black hover:bg-gray-200"
          }`}
        >
          {isActive ? "Pause" : "Activate"}
        </button>
      </header>

      {(error || message) && (
        <div className="space-y-2 text-sm">
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-100">
              {message}
            </p>
          )}
        </div>
      )}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div>
          <h2 className="font-medium">Conversions</h2>
          <p className="text-xs text-white/40 mt-1">
            Acquisition + lifecycle · last click 30 zile · fără Send Test
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Signups", conversions.signups],
            ["Trials", conversions.trials],
            ["Paid", conversions.paid],
            [
              "Signup rate",
              conversions.signup_rate == null
                ? "—"
                : `${conversions.signup_rate}%`,
            ],
            [
              "Paid rate",
              conversions.paid_rate == null ? "—" : `${conversions.paid_rate}%`,
            ],
            [
              "Attributed MRR",
              `${conversions.attributed_mrr.toFixed(0)} ${conversions.currency}`,
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg bg-black/25 p-3">
              <dt className="text-xs text-white/40">{label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <h2 className="font-medium">Run Test</h2>
        <p className="text-sm text-white/50">
          Trimite template-ul real prin Resend către o adresă controlată. Nu
          creează trigger lifecycle și nu modifică trial/subscription.
        </p>
        <form onSubmit={sendTest} className="flex flex-col md:flex-row gap-2">
          <input
            required
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="adresa-ta-de-test@example.com"
            className="flex-1 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-white text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Send Test
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Runs</h2>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  statusFilter === status
                    ? "bg-white text-black"
                    : "border border-white/15 text-white/60 hover:bg-white/10"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.04] text-left text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Trigger</th>
                <th className="px-4 py-3 font-medium">Scheduled</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Skip / Error</th>
                <th className="px-4 py-3 font-medium">Provider ID</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-white/40"
                  >
                    Niciun run încă.
                  </td>
                </tr>
              ) : (
                runs.map((run) => {
                  const name = [run.contact_first_name, run.contact_last_name]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <tr
                      key={run.id}
                      className="border-t border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div>{name || "—"}</div>
                        <div className="text-white/45 text-xs">
                          {run.contact_email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-xs break-all">
                        {run.trigger_reference}
                      </td>
                      <td className="px-4 py-3 text-white/55">
                        {new Date(run.scheduled_for).toLocaleString("ro-RO")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-md bg-white/10 px-2 py-0.5 text-xs">
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/55">
                        {run.sent_at
                          ? new Date(run.sent_at).toLocaleString("ro-RO")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">
                        {run.skip_reason || run.last_error || "—"}
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs break-all">
                        {run.provider_message_id || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

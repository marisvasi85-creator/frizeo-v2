"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useEmailHref } from "../components/EmailPathContext";
import type {
  LifecycleSettings,
  LifecycleTenantRow,
} from "@/lib/frizeo-email/lifecycle";

const STAGE_OPTIONS = [
  "all",
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
];

export default function LifecycleClient({
  settings,
  tenants,
  funnel,
  stage,
  outreach,
}: {
  settings: LifecycleSettings;
  tenants: LifecycleTenantRow[];
  funnel: Record<string, number>;
  stage: string;
  outreach: string;
}) {
  const router = useRouter();
  const hrefFor = useEmailHref();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [zeroCohort, setZeroCohort] = useState(
    settings.allow_existing_zero_booking_cohort,
  );
  const [testIds, setTestIds] = useState(settings.test_contact_ids.join("\n"));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/email/lifecycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          allow_existing_zero_booking_cohort: zeroCohort,
          test_contact_ids: testIds
            .split(/[\s,]+/)
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nu am putut salva.");
        return;
      }
      setMessage(
        data.settings?.enabled
          ? "Strategia v2 e activă. Folosește doar contacte de test până la verificarea completă."
          : "Strategia v2 rămâne oprită. Discover-ul vechi (pe zile) e neschimbat.",
      );
      startTransition(() => router.refresh());
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setBusy(false);
    }
  };

  const setOutreach = async (tenantId: string, outreach_status: string) => {
    await fetch(`/api/email/lifecycle/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outreach_status }),
    });
    startTransition(() => router.refresh());
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Lifecycle
        </h1>
        <p className="mt-2 text-sm text-frz-ink/60 max-w-3xl">
          Stadiul fiecărui salon e calculat din date reale. Strategia v2 este
          oprită implicit și nu retrimite emailuri istorice.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      )}

      <section className="rounded-xl border border-frz-line bg-frz-card p-5 space-y-4">
        <h2 className="font-medium">Feature flag</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Activează lifecycle v2 (doar după test controlat)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={zeroCohort}
            onChange={(event) => setZeroCohort(event.target.checked)}
          />
          Include cohorța existentă „setup complet, zero programări”
        </label>
        <div>
          <p className="text-sm text-frz-muted mb-1">
            Contacte de test (UUID, unul pe linie). Gol = toate saloanele, dacă
            flag-ul e on.
          </p>
          <textarea
            className="w-full min-h-[88px] rounded-lg border border-frz-line bg-frz-fog px-3 py-2 text-sm"
            value={testIds}
            onChange={(event) => setTestIds(event.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || pending}
          className="rounded-lg bg-frz-ink text-frz-ink-contrast px-4 py-2 text-sm"
        >
          Salvează flag-ul
        </button>
        <p className="text-xs text-frz-muted">
          Pornit la: {settings.strategy_started_at || "—"} · versiune{" "}
          {settings.strategy_version}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(funnel).map(([key, value]) => (
          <div
            key={key}
            className="rounded-xl border border-frz-line bg-frz-card px-4 py-3"
          >
            <p className="text-xs text-frz-muted">{key.replace(/_/g, " ")}</p>
            <p className="mt-1 text-2xl tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <select
          className="rounded-lg border border-frz-line bg-frz-fog px-3 py-2"
          value={stage}
          onChange={(event) => {
            const params = new URLSearchParams();
            if (event.target.value !== "all") params.set("stage", event.target.value);
            if (outreach !== "all") params.set("outreach", outreach);
            startTransition(() =>
              router.push(hrefFor(`/lifecycle?${params.toString()}`)),
            );
          }}
        >
          {STAGE_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-frz-line bg-frz-fog px-3 py-2"
          value={outreach}
          onChange={(event) => {
            const params = new URLSearchParams();
            if (stage !== "all") params.set("stage", stage);
            if (event.target.value !== "all") {
              params.set("outreach", event.target.value);
            }
            startTransition(() =>
              router.push(hrefFor(`/lifecycle?${params.toString()}`)),
            );
          }}
        >
          <option value="all">Toate outreach</option>
          <option value="none">none</option>
          <option value="needs_activation">Necesită activare</option>
          <option value="contacted">contacted</option>
          <option value="waiting">waiting</option>
          <option value="done">done</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-frz-line">
        <table className="min-w-full text-sm">
          <thead className="bg-frz-fog text-left text-frz-muted">
            <tr>
              <th className="px-4 py-3">Salon</th>
              <th className="px-4 py-3">Stadiu</th>
              <th className="px-4 py-3">Programări</th>
              <th className="px-4 py-3">Ultima activitate</th>
              <th className="px-4 py-3">Ultimul email</th>
              <th className="px-4 py-3">Next action</th>
              <th className="px-4 py-3">Outreach</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-frz-muted">
                  Niciun salon clasificat încă. Flag-ul e off; clasificarea se
                  face la discover sau la refresh manual.
                </td>
              </tr>
            ) : (
              tenants.map((row) => (
                <tr key={row.tenant_id} className="border-t border-frz-line/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.tenant_name || "—"}</div>
                    <div className="text-xs text-frz-muted">
                      {row.contact_email || row.tenant_slug || row.tenant_id}
                    </div>
                  </td>
                  <td className="px-4 py-3">{row.stage}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.recorded_bookings} · online {row.online_bookings}
                  </td>
                  <td className="px-4 py-3 text-frz-muted">
                    {row.last_activity_at
                      ? new Date(row.last_activity_at).toLocaleString("ro-RO")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-frz-muted">
                    {row.last_automation_key || "—"}
                    {row.last_automation_sent_at
                      ? ` · ${new Date(row.last_automation_sent_at).toLocaleString("ro-RO")}`
                      : ""}
                  </td>
                  <td className="px-4 py-3">{row.next_best_action}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-md border border-frz-line bg-frz-fog px-2 py-1 text-xs"
                      value={row.outreach_status}
                      onChange={(event) =>
                        void setOutreach(row.tenant_id, event.target.value)
                      }
                    >
                      <option value="none">none</option>
                      <option value="needs_activation">necesită activare</option>
                      <option value="contacted">contacted</option>
                      <option value="waiting">waiting</option>
                      <option value="done">done</option>
                    </select>
                    {row.unused_reason ? (
                      <div className="mt-1 text-xs text-frz-muted">
                        {row.unused_reason}
                      </div>
                    ) : null}
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

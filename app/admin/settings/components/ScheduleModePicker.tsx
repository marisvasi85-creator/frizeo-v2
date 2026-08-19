"use client";

import { useState } from "react";
import type { ScheduleMode } from "@/lib/schedule/resolveDaySchedule";
import AdminButton from "../../components/AdminButton";
import AdminCard from "../../components/AdminCard";
import { useSavedFeedback } from "../../components/useSavedFeedback";

export default function ScheduleModePicker({
  barberId,
  initialMode,
  onModeChange,
}: {
  barberId: string;
  initialMode: ScheduleMode;
  onModeChange?: (mode: ScheduleMode) => void;
}) {
  const [mode, setMode] = useState<ScheduleMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { saved, markSaved, clearSaved } = useSavedFeedback();

  async function save(next: ScheduleMode) {
    if (next === mode) return;
    setLoading(true);
    setError("");
    clearSaved();
    try {
      const res = await fetch("/api/barbers/schedule-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barber_id: barberId, schedule_mode: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nu am putut schimba modul.");
        return;
      }
      setMode(next);
      onModeChange?.(next);
      markSaved();
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminCard padding="sm" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Tip program</h2>
        <p className="text-sm text-frz-ink/55 mt-1">
          Implicit rămâne programul săptămânal. Programul selectiv e opțional:
          deschizi doar zilele pe care le setezi tu în calendar.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void save("weekly")}
          className={`px-3 py-2 rounded-lg text-sm border ${
            mode === "weekly"
              ? "bg-frz-ink text-white border-frz-ink"
              : "bg-frz-fog text-frz-ink/70 border-frz-line"
          }`}
        >
          Program săptămânal
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void save("selective")}
          className={`px-3 py-2 rounded-lg text-sm border ${
            mode === "selective"
              ? "bg-amber-400 text-black border-amber-300"
              : "bg-frz-fog text-frz-ink/70 border-frz-line"
          }`}
        >
          Program selectiv
        </button>
        {saved && (
          <span className="self-center text-sm text-emerald-600">Salvat ✔</span>
        )}
      </div>

      {mode === "weekly" ? (
        <p className="text-sm text-frz-ink/50">
          Lucrezi după orarul săptămânal. Zilele speciale / concediile rămân
          excepții și se păstrează dacă treci pe selectiv.
        </p>
      ) : (
        <p className="text-sm text-amber-700/80">
          Orarul săptămânal nu mai deschide sloturi. Zilele setate și
          concediile rămân în listă și dacă revii la săptămânal.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && (
        <AdminButton disabled loading loadingLabel="Se salvează...">
          Se salvează...
        </AdminButton>
      )}
    </AdminCard>
  );
}

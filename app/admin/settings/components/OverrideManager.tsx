"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarDays } from "lucide-react";
import type { Override, OverrideMode } from "@/types/override";

function toLocalDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateRO(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ro-RO");
}

function normTime(t: string | null | undefined) {
  if (!t) return "";
  return t.slice(0, 5);
}

function describeOverride(item: Override) {
  if (item.is_closed) {
    return { label: "Zi liberă", detail: "Salon închis", tone: "text-red-400" };
  }

  const start = normTime(item.work_start);
  const end = normTime(item.work_end);

  if (start && end) {
    let detail = `Program ${start} – ${end}`;
    if (item.break_enabled && item.break_start && item.break_end) {
      detail += ` · Pauză ${normTime(item.break_start)} – ${normTime(item.break_end)}`;
    }
    return {
      label: "Program special",
      detail,
      tone: "text-amber-400",
    };
  }

  return { label: "Zi specială", detail: "", tone: "text-white/60" };
}

export default function OverrideManager({ barberId }: { barberId: string }) {
  const [date, setDate] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mode, setMode] = useState<OverrideMode>("closed");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [breakEnabled, setBreakEnabled] = useState(false);
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("14:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overrides, setOverrides] = useState<Override[]>([]);

  async function loadOverrides() {
    const res = await fetch(`/api/barber-overrides?barberId=${barberId}`);
    const data = await res.json();
    setOverrides(data.overrides || []);
  }

  useEffect(() => {
    loadOverrides();
  }, [barberId]);

  function resetForm() {
    setDate("");
    setSelectedDate(null);
    setMode("closed");
    setWorkStart("09:00");
    setWorkEnd("18:00");
    setBreakEnabled(false);
    setBreakStart("13:00");
    setBreakEnd("14:00");
    setError("");
  }

  function loadIntoForm(item: Override) {
    setDate(item.date);
    const [y, m, d] = item.date.split("-").map(Number);
    setSelectedDate(new Date(y, m - 1, d));

    if (item.is_closed) {
      setMode("closed");
      return;
    }

    setMode("custom");
    setWorkStart(normTime(item.work_start) || "09:00");
    setWorkEnd(normTime(item.work_end) || "18:00");
    setBreakEnabled(!!item.break_enabled);
    setBreakStart(normTime(item.break_start) || "13:00");
    setBreakEnd(normTime(item.break_end) || "14:00");
    setError("");
  }

  function validate(): string | null {
    if (!date) return "Selectează o dată";

    if (mode === "custom") {
      if (!workStart || !workEnd) return "Completează programul";
      if (workStart >= workEnd) {
        return "Ora de început trebuie să fie înainte de ora de final";
      }

      if (breakEnabled) {
        if (!breakStart || !breakEnd) return "Completează pauza";
        if (breakStart >= breakEnd) return "Pauza este invalidă";
        if (breakStart < workStart || breakEnd > workEnd) {
          return "Pauza trebuie să fie în intervalul programului";
        }
      }
    }

    return null;
  }

  async function saveOverride() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    const payload =
      mode === "closed"
        ? {
            barber_id: barberId,
            date,
            is_closed: true,
          }
        : {
            barber_id: barberId,
            date,
            is_closed: false,
            work_start: workStart,
            work_end: workEnd,
            break_enabled: breakEnabled,
            break_start: breakEnabled ? breakStart : null,
            break_end: breakEnabled ? breakEnd : null,
          };

    const res = await fetch("/api/barber-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Nu s-a putut salva");
      setLoading(false);
      return;
    }

    resetForm();
    await loadOverrides();
    setLoading(false);
  }

  async function deleteOverride(targetDate: string) {
    const ok = confirm("Ștergi această zi specială?");
    if (!ok) return;

    const res = await fetch(
      `/api/barber-overrides?barberId=${barberId}&date=${targetDate}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      if (date === targetDate) resetForm();
      loadOverrides();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Zile speciale</h2>
        <p className="text-sm text-white/60 mt-1">
          Concedii, sărbători sau program diferit față de cel săptămânal.
        </p>
      </div>

      <div className="bg-[#161618] border border-white/10 p-4 rounded-xl space-y-4">
        <div className="relative w-full">
          <DatePicker
            selected={selectedDate}
            onChange={(picked: Date | null) => {
              setSelectedDate(picked);
              if (picked) setDate(toLocalDateString(picked));
            }}
            dateFormat="dd.MM.yyyy"
            placeholderText="Selectează data"
            minDate={new Date()}
            className="w-full bg-[#0F0F10] text-white border border-white/10 px-4 py-3 pr-12 rounded-lg"
          />
          <CalendarDays
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("closed")}
            className={`px-3 py-2 rounded-lg text-sm ${
              mode === "closed"
                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                : "bg-[#0F0F10] text-white/70 border border-white/10"
            }`}
          >
            Zi liberă
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`px-3 py-2 rounded-lg text-sm ${
              mode === "custom"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-[#0F0F10] text-white/70 border border-white/10"
            }`}
          >
            Program special
          </button>
        </div>

        {mode === "custom" && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-white/60 w-full sm:w-auto">
                Program:
              </span>
              <input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
              />
              <span className="text-white/40">–</span>
              <input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setBreakEnabled((v) => !v)}
                className={`text-sm ${
                  breakEnabled ? "text-green-400" : "text-white/60"
                }`}
              >
                {breakEnabled
                  ? "✔ Pauză activă (click pentru eliminare)"
                  : "+ Adaugă pauză"}
              </button>

              {breakEnabled && (
                <div className="flex flex-wrap gap-2">
                  <input
                    type="time"
                    value={breakStart}
                    onChange={(e) => setBreakStart(e.target.value)}
                    className="bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
                  />
                  <input
                    type="time"
                    value={breakEnd}
                    onChange={(e) => setBreakEnd(e.target.value)}
                    className="bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-white/50">
              Poți lucra și într-o zi în care, în mod normal, ești liber (ex.
              sâmbătă extra).
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={saveOverride}
            disabled={!date || loading}
            className="bg-white text-black px-4 py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "Se salvează..." : "Salvează zi specială"}
          </button>

          {date && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-3 rounded-lg text-sm text-white/70 border border-white/10"
            >
              Anulează
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {overrides.length === 0 && (
          <div className="text-white/50 text-sm">Nu există zile speciale.</div>
        )}

        {overrides
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((item) => {
            const info = describeOverride(item);

            return (
              <div
                key={item.id ?? item.date}
                className="bg-[#161618] border border-white/10 p-4 rounded-xl flex justify-between items-start gap-4"
              >
                <div>
                  <div className="font-medium">{formatDateRO(item.date)}</div>
                  <div className={`text-sm ${info.tone}`}>{info.label}</div>
                  {info.detail && (
                    <div className="text-sm text-white/60 mt-1">
                      {info.detail}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={() => loadIntoForm(item)}
                    className="text-white/70 hover:text-white text-sm"
                  >
                    Editează
                  </button>
                  <button
                    onClick={() => deleteOverride(item.date)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Șterge
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

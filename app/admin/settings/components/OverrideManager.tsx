"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import LazyDatePicker from "../../components/LazyDatePicker";
import type { Override, OverrideMode } from "@/types/override";
import type { ScheduleMode } from "@/lib/schedule/resolveDaySchedule";
import {
  formatVacationPeriodRO,
  groupVacationPeriods,
  vacationPeriodCoversDate,
} from "@/lib/schedule/vacationPeriods";
import AdminButton from "../../components/AdminButton";
import AdminCard from "../../components/AdminCard";
import EmptyState from "../../components/EmptyState";
import { useSavedFeedback } from "../../components/useSavedFeedback";

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

function describeOverride(item: Override, selective: boolean) {
  if (item.is_closed) {
    return {
      label: selective ? "Închis" : "Zi liberă",
      detail: "Închis",
      tone: "text-red-600",
    };
  }

  const start = normTime(item.work_start);
  const end = normTime(item.work_end);

  if (start && end) {
    let detail = `${start} – ${end}`;
    if (item.break_enabled && item.break_start && item.break_end) {
      detail += ` · Pauză ${normTime(item.break_start)} – ${normTime(item.break_end)}`;
    }
    return {
      label: selective ? "Lucrez" : "Program special",
      detail,
      tone: "text-amber-600",
    };
  }

  return { label: "Zi specială", detail: "", tone: "text-frz-ink/60" };
}

export default function OverrideManager({
  barberId,
  initialOverrides = [],
  scheduleMode = "weekly",
}: {
  barberId: string;
  initialOverrides?: Override[];
  scheduleMode?: ScheduleMode;
}) {
  const isSelective = scheduleMode === "selective";

  const [date, setDate] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mode, setMode] = useState<OverrideMode>(
    isSelective ? "custom" : "closed",
  );
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [breakEnabled, setBreakEnabled] = useState(false);
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("14:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overrides, setOverrides] = useState<Override[]>(initialOverrides);

  const [vacationStart, setVacationStart] = useState<Date | null>(null);
  const [vacationEnd, setVacationEnd] = useState<Date | null>(null);
  const [vacationLoading, setVacationLoading] = useState(false);
  const [vacationError, setVacationError] = useState("");
  const {
    saved: vacationSaved,
    markSaved: markVacationSaved,
    clearSaved: clearVacationSaved,
  } = useSavedFeedback();
  const {
    saved: daySaved,
    markSaved: markDaySaved,
    clearSaved: clearDaySaved,
  } = useSavedFeedback();

  const vacationPeriods = useMemo(
    () => groupVacationPeriods(overrides),
    [overrides],
  );

  const singleOverrides = useMemo(() => {
    return overrides
      .filter(
        (item) =>
          !item.vacation_period_id &&
          !vacationPeriodCoversDate(vacationPeriods, item.date),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [overrides, vacationPeriods]);

  async function loadOverrides() {
    const res = await fetch(`/api/barber-overrides?barberId=${barberId}`);
    const data = await res.json();
    setOverrides(data.overrides || []);
  }

  function resetForm() {
    setDate("");
    setSelectedDate(null);
    setMode(isSelective ? "custom" : "closed");
    setWorkStart("09:00");
    setWorkEnd("18:00");
    setBreakEnabled(false);
    setBreakStart("13:00");
    setBreakEnd("14:00");
    setError("");
  }

  function resetVacationForm() {
    setVacationStart(null);
    setVacationEnd(null);
    setVacationError("");
  }

  function pickDate(picked: Date | null) {
    setSelectedDate(picked);
    if (!picked) {
      setDate("");
      return;
    }

    const nextDate = toLocalDateString(picked);
    setDate(nextDate);
    setError("");

    const existing = overrides.find((item) => item.date === nextDate);
    if (existing) {
      loadIntoForm(existing);
      return;
    }

    setMode(isSelective ? "custom" : mode);
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
    if (!date) return "Selectează o zi din calendar";

    if (mode === "custom") {
      if (!workStart || !workEnd) return "Completează orele";
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

  async function saveVacation() {
    if (!vacationStart || !vacationEnd) {
      setVacationError("Selectează perioada de concediu (de la – până la).");
      return;
    }

    setVacationLoading(true);
    setVacationError("");
    clearVacationSaved();

    const res = await fetch("/api/barber-overrides/vacation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: barberId,
        date_from: toLocalDateString(vacationStart),
        date_to: toLocalDateString(vacationEnd),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setVacationError(data.error || "Nu s-a putut salva concediul.");
      setVacationLoading(false);
      return;
    }

    resetVacationForm();
    await loadOverrides();
    markVacationSaved();
    setVacationLoading(false);
  }

  async function deleteVacation(periodId: string) {
    const ok = confirm("Ștergi întreaga perioadă de concediu?");
    if (!ok) return;

    setVacationError("");

    const res = await fetch(
      `/api/barber-overrides/vacation?barberId=${barberId}&vacationPeriodId=${periodId}`,
      { method: "DELETE" },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setVacationError(data.error || "Nu s-a putut șterge concediul.");
      return;
    }

    await loadOverrides();
  }

  async function saveOverride() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    clearDaySaved();

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
    markDaySaved();
    setLoading(false);
  }

  async function deleteOverride(targetDate: string) {
    const ok = confirm(
      isSelective ? "Ștergi această zi din program?" : "Ștergi această zi specială?",
    );
    if (!ok) return;

    setError("");

    const res = await fetch(
      `/api/barber-overrides?barberId=${barberId}&date=${targetDate}`,
      { method: "DELETE" },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Nu s-a putut șterge");
      return;
    }

    if (date === targetDate) resetForm();
    await loadOverrides();
  }

  const hasAnyEntries = vacationPeriods.length > 0 || singleOverrides.length > 0;

  const dayForm = (
    <AdminCard padding="sm" className="space-y-4">
      {!isSelective && (
        <div>
          <h3 className="font-medium">O singură zi</h3>
          <p className="text-sm text-white/50 mt-1">
            Pentru o zi liberă sau program special (nu concediu pe perioadă).
          </p>
        </div>
      )}

      <div className="relative w-full">
        <LazyDatePicker
          selected={selectedDate}
          onChange={(picked: Date | null) => pickDate(picked)}
          dateFormat="dd.MM.yyyy"
          placeholderText="Selectează ziua"
          minDate={new Date()}
          className="w-full bg-frz-fog text-frz-ink border border-frz-line px-4 py-3 pr-12 rounded-lg"
          inline={isSelective}
        />
        {!isSelective && (
          <CalendarDays
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-frz-ink/40 pointer-events-none"
          />
        )}
      </div>

      {date && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`px-3 py-2 rounded-lg text-sm border ${
                mode === "custom"
                  ? "bg-amber-400 text-black border-amber-300"
                  : "bg-frz-fog text-frz-ink/70 border-frz-line"
              }`}
            >
              Lucrez
            </button>
            <button
              type="button"
              onClick={() => setMode("closed")}
              className={`px-3 py-2 rounded-lg text-sm border ${
                mode === "closed"
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-frz-fog text-frz-ink/70 border-frz-line"
              }`}
            >
              Închis
            </button>
          </div>

          {mode === "custom" && (
            <div className="space-y-3">
              <p className="text-sm text-frz-ink/60">Ore</p>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="time"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="bg-frz-fog border border-frz-line px-3 py-2 rounded text-sm text-frz-ink"
                />
                <span className="text-frz-ink/40">–</span>
                <input
                  type="time"
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                  className="bg-frz-fog border border-frz-line px-3 py-2 rounded text-sm text-frz-ink"
                />
              </div>

              <button
                type="button"
                onClick={() => setBreakEnabled((v) => !v)}
                className={`text-sm ${
                  breakEnabled ? "text-emerald-600" : "text-frz-ink/50"
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
                    className="bg-frz-fog border border-frz-line px-3 py-2 rounded text-sm text-frz-ink"
                  />
                  <input
                    type="time"
                    value={breakEnd}
                    onChange={(e) => setBreakEnd(e.target.value)}
                    className="bg-frz-fog border border-frz-line px-3 py-2 rounded text-sm text-frz-ink"
                  />
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <AdminButton
              onClick={saveOverride}
              disabled={!date || loading || daySaved}
              loading={loading}
              loadingLabel="Se salvează..."
              saved={daySaved}
              savedLabel="Salvat ✔"
            >
              Salvează ziua
            </AdminButton>

            <AdminButton variant="secondary" onClick={resetForm}>
              Anulează
            </AdminButton>
          </div>
        </>
      )}
    </AdminCard>
  );

  const daysList = (
    <div className="space-y-3">
      <h3 className="font-medium">
        {isSelective ? "Zile setate" : "Zile speciale salvate"}
      </h3>

      {!hasAnyEntries && (
        <EmptyState className="py-8 text-sm">
          {isSelective
            ? "Nicio zi setată încă. Alege o zi din calendar."
            : "Nu există concedii sau zile speciale."}
        </EmptyState>
      )}

      {vacationPeriods.map((period) => (
        <AdminCard
          key={period.id}
          padding="sm"
          className="flex justify-between items-start gap-4"
        >
          <div>
            <div className="font-medium">
              {formatVacationPeriodRO(period)}
            </div>
            <div className="text-sm text-blue-600">Concediu</div>
            <div className="text-sm text-frz-ink/60 mt-1">
              {period.dayCount} {period.dayCount === 1 ? "zi" : "zile"} ·
              închis
            </div>
          </div>

          <button
            onClick={() => deleteVacation(period.id)}
            className="text-red-600 hover:text-red-500 text-sm shrink-0"
          >
            Șterge
          </button>
        </AdminCard>
      ))}

      {singleOverrides.map((item) => {
        const info = describeOverride(item, isSelective);

        return (
          <AdminCard
            key={item.id ?? item.date}
            padding="sm"
            className="flex justify-between items-start gap-4"
          >
            <div>
              <div className="font-medium">{formatDateRO(item.date)}</div>
              <div className={`text-sm ${info.tone}`}>{info.label}</div>
              {info.detail && (
                <div className="text-sm text-frz-ink/60 mt-1">{info.detail}</div>
              )}
            </div>

            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => loadIntoForm(item)}
                className="text-frz-ink/70 hover:text-frz-ink text-sm"
              >
                Editează
              </button>
              <button
                onClick={() => deleteOverride(item.date)}
                className="text-red-600 hover:text-red-500 text-sm"
              >
                Șterge
              </button>
            </div>
          </AdminCard>
        );
      })}
    </div>
  );

  if (isSelective) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Zile de lucru</h2>
          <p className="text-sm text-frz-ink/60 mt-1">
            Alege o zi → Lucrez sau Închis → setează orele → salvează. Zilele
            apar mai jos, cu opțiune de editare. Rămân valabile și dacă revii
            la program săptămânal.
          </p>
        </div>

        {dayForm}

        <AdminCard padding="sm" className="space-y-4">
          <div>
            <h3 className="font-medium">Concediu</h3>
            <p className="text-sm text-frz-ink/50 mt-1">
              Opțional: închide mai multe zile odată.
            </p>
          </div>

          <div className="relative w-full">
            <LazyDatePicker
              selectsRange
              startDate={vacationStart}
              endDate={vacationEnd}
              onChange={(dates: [Date | null, Date | null] | Date | null) => {
                const [start, end] = (Array.isArray(dates)
                  ? dates
                  : [dates, null]) as [Date | null, Date | null];
                setVacationStart(start);
                setVacationEnd(end ?? null);
              }}
              dateFormat="dd.MM.yyyy"
              placeholderText="De la – Până la"
              minDate={new Date()}
              className="w-full bg-frz-fog text-frz-ink border border-frz-line px-4 py-3 pr-12 rounded-lg"
            />
            <CalendarDays
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-frz-ink/40 pointer-events-none"
            />
          </div>

          {vacationError && (
            <p className="text-sm text-red-600">{vacationError}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <AdminButton
              onClick={saveVacation}
              disabled={
                !vacationStart ||
                !vacationEnd ||
                vacationLoading ||
                vacationSaved
              }
              loading={vacationLoading}
              loadingLabel="Se salvează..."
              saved={vacationSaved}
              savedLabel="Salvat ✔"
            >
              Salvează concediu
            </AdminButton>

            {(vacationStart || vacationEnd) && (
              <AdminButton variant="secondary" onClick={resetVacationForm}>
                Anulează
              </AdminButton>
            )}
          </div>
        </AdminCard>

        {daysList}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Zile speciale</h2>
        <p className="text-sm text-frz-ink/60 mt-1">
          Concedii pe perioadă, zile libere sau program diferit față de cel
          săptămânal.
        </p>
      </div>

      <AdminCard padding="sm" className="space-y-4">
        <div>
          <h3 className="font-medium">Concediu</h3>
          <p className="text-sm text-frz-ink/50 mt-1">
            Toate zilele din perioadă vor fi închise. Clienții vor vedea
            „Concediu” la programare.
          </p>
        </div>

        <div className="relative w-full">
          <LazyDatePicker
            selectsRange
            startDate={vacationStart}
            endDate={vacationEnd}
            onChange={(dates: [Date | null, Date | null] | Date | null) => {
              const [start, end] = (Array.isArray(dates)
                ? dates
                : [dates, null]) as [Date | null, Date | null];
              setVacationStart(start);
              setVacationEnd(end ?? null);
            }}
            dateFormat="dd.MM.yyyy"
            placeholderText="De la – Până la"
            minDate={new Date()}
            className="w-full bg-frz-fog text-frz-ink border border-frz-line px-4 py-3 pr-12 rounded-lg"
          />
          <CalendarDays
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-frz-ink/40 pointer-events-none"
          />
        </div>

        {vacationError && (
          <p className="text-sm text-red-600">{vacationError}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <AdminButton
            onClick={saveVacation}
            disabled={
              !vacationStart || !vacationEnd || vacationLoading || vacationSaved
            }
            loading={vacationLoading}
            loadingLabel="Se salvează..."
            saved={vacationSaved}
            savedLabel="Salvat ✔"
          >
            Salvează concediu
          </AdminButton>

          {(vacationStart || vacationEnd) && (
            <AdminButton variant="secondary" onClick={resetVacationForm}>
              Anulează
            </AdminButton>
          )}
        </div>
      </AdminCard>

      {dayForm}
      {daysList}
    </div>
  );
}

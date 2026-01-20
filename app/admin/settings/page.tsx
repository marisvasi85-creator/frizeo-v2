"use client";

import { useEffect, useState } from "react";

const BARBER_ID = "11111111-1111-1111-1111-111111111111"; // ← barberul tău

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);

  // ===== STATE =====
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("17:00");

  const [slotMinutes, setSlotMinutes] = useState(30);
  const [cancelLimitHours, setCancelLimitHours] = useState(24);

  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [breakStart, setBreakStart] = useState<string | null>(null);
  const [breakEnd, setBreakEnd] = useState<string | null>(null);

  // ===== LOAD EXISTING SETTINGS =====
  useEffect(() => {
    fetch(`/api/barber-settings?barberId=${BARBER_ID}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data) return;

        setWorkStart(data.work_start);
        setWorkEnd(data.work_end);
        setSlotMinutes(data.slot_duration);
        setCancelLimitHours(data.cancel_limit_hours);
        setWorkingDays(data.working_days || []);

        setBreakStart(data.break_start);
        setBreakEnd(data.break_end);
      });
  }, []);

  // ===== SAVE =====
  async function saveSettings() {
  setLoading(true);

  const payload = {
    barber_id: BARBER_ID,

    // 🔴 OBLIGATORII
    slot_duration: slotMinutes,
    start_time: workStart,
    end_time: workEnd,
    work_start: workStart,
    work_end: workEnd,
    working_days: workingDays,
    cancel_limit_hours: cancelLimitHours,

    // 🟡 OPȚIONALE
    break_enabled: !!breakStart && !!breakEnd,
    break_start: breakStart,
    break_end: breakEnd,
  };

  const res = await fetch("/api/barber-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  setLoading(false);

  if (!res.ok) {
    alert("EROARE: " + data.error);
    return;
  }

  alert("Setări salvate");
}

  // ===== UI =====
  return (
    <div style={{ maxWidth: 420 }}>
      <h2>Program general</h2>

      <label>Start lucru</label>
      <input
        type="time"
        value={workStart}
        onChange={(e) => setWorkStart(e.target.value)}
      />

      <label>Final lucru</label>
      <input
        type="time"
        value={workEnd}
        onChange={(e) => setWorkEnd(e.target.value)}
      />

      <label>Durată slot (minute)</label>
      <input
        type="number"
        min={5}
        step={5}
        value={slotMinutes}
        onChange={(e) => setSlotMinutes(Number(e.target.value))}
      />

      <label>Limită anulare (ore)</label>
      <input
        type="number"
        min={1}
        value={cancelLimitHours}
        onChange={(e) => setCancelLimitHours(Number(e.target.value))}
      />

      <h3>Zile lucrătoare</h3>
      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
        <label key={d} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={workingDays.includes(d)}
            onChange={() =>
              setWorkingDays((prev) =>
                prev.includes(d)
                  ? prev.filter((x) => x !== d)
                  : [...prev, d]
              )
            }
          />
          Ziua {d === 0 ? "Duminică" : d}
        </label>
      ))}

      <h3>Pauză (opțional)</h3>

      <label>Pauză start</label>
      <input
        type="time"
        value={breakStart ?? ""}
        onChange={(e) =>
          setBreakStart(e.target.value || null)
        }
      />

      <label>Pauză end</label>
      <input
        type="time"
        value={breakEnd ?? ""}
        onChange={(e) =>
          setBreakEnd(e.target.value || null)
        }
      />

      <br />
      <br />

      <button onClick={saveSettings} disabled={loading}>
        {loading ? "Salvare..." : "Salvează"}
      </button>
    </div>
  );
}

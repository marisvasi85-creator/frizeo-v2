"use client";

import { useEffect, useState } from "react";

const DAYS = [
  { label: "Luni", value: 1 },
  { label: "Marți", value: 2 },
  { label: "Miercuri", value: 3 },
  { label: "Joi", value: 4 },
  { label: "Vineri", value: 5 },
  { label: "Sâmbătă", value: 6 },
  { label: "Duminică", value: 0 },
];

export default function DefaultSchedule() {
  // TEMP – exact cum ai peste tot
  const barberId = "d0bc5fec-f37a-4e8a-94ab-b3ef9880374c";

  const [slotDuration, setSlotDuration] = useState(30);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [breakEnabled, setBreakEnabled] = useState(false);
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");

  const [message, setMessage] = useState("");

  /* ================= LOAD SETTINGS ================= */
  useEffect(() => {
  fetch(`/api/barber-settings?barberId=${barberId}`)
    .then(async (res) => {
      if (!res.ok) {
        console.warn("barber-settings response:", res.status);
        return null;
      }
      return res.json();
    })
    .then((data) => {
      if (!data) return;

      setSlotDuration(data.slot_duration);
      setStartTime(data.start_time);
      setEndTime(data.end_time);
      setWorkingDays(data.working_days);

      setBreakEnabled(data.break_enabled);
      setBreakStart(data.break_start ?? "13:00");
      setBreakEnd(data.break_end ?? "14:00");
    })
    .catch((err) => {
      console.error("LOAD SETTINGS ERROR:", err);
    });
}, [barberId]);


  /* ================= SAVE ================= */
  async function saveSettings() {
    setMessage("");

    const res = await fetch("/api/barber-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: barberId,
        slot_duration: slotDuration,
        start_time: startTime,
        end_time: endTime,
        working_days: workingDays,
        break_enabled: breakEnabled,
        break_start: breakEnabled ? breakStart : null,
        break_end: breakEnabled ? breakEnd : null,
      }),
    });

    if (res.ok) {
      setMessage("✅ Program salvat");
    } else {
      setMessage("❌ Eroare la salvare");
    }
  }

  function toggleDay(day: number) {
    setWorkingDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  }

  return (
    <div>
      <h2>⚙️ Program standard</h2>

      <label>Durată slot (minute)</label>
      <br />
      <input
        type="number"
        value={slotDuration}
        min={5}
        step={5}
        onChange={(e) => setSlotDuration(Number(e.target.value))}
      />

      <br /><br />

      <label>Oră început</label>
      <br />
      <input
        type="time"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
      />

      <br /><br />

      <label>Oră sfârșit</label>
      <br />
      <input
        type="time"
        value={endTime}
        onChange={(e) => setEndTime(e.target.value)}
      />

      <br /><br />

      <label>Zile lucrătoare</label>
      <br />
      {DAYS.map((day) => (
        <button
          key={day.value}
          onClick={() => toggleDay(day.value)}
          style={{
            margin: 4,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #333",
            background: workingDays.includes(day.value)
              ? "#2563eb"
              : "#eee",
            color: workingDays.includes(day.value)
              ? "#fff"
              : "#000",
          }}
        >
          {day.label}
        </button>
      ))}

      <br /><br />

      <label>
        <input
          type="checkbox"
          checked={breakEnabled}
          onChange={(e) => setBreakEnabled(e.target.checked)}
        />
        Pauză
      </label>

      {breakEnabled && (
        <>
          <br />
          <input
            type="time"
            value={breakStart}
            onChange={(e) => setBreakStart(e.target.value)}
          />
          <input
            type="time"
            value={breakEnd}
            onChange={(e) => setBreakEnd(e.target.value)}
            style={{ marginLeft: 8 }}
          />
        </>
      )}

      <br /><br />

      <button onClick={saveSettings}>Salvează</button>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}

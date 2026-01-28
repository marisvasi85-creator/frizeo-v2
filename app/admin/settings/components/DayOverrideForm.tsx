"use client";

import { useState } from "react";

const BARBER_ID = "d0bc5fec-f37a-4e8a-94ab-b3ef9880374c"; // TEMP, la fel ca în DefaultSchedule

export default function DayOverrideForm() {
  const [date, setDate] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function saveOverride() {
    setMessage("");

    if (!date) {
      setMessage("Selectează o dată");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/barber-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberId: BARBER_ID,
        date,
        is_closed: isClosed,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Eroare la salvare");
    } else {
      setMessage("Override salvat cu succes");
    }

    setLoading(false);
  }

  return (
    <div style={{ marginTop: 16 }}>
      <label>Data</label>
      <br />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <br /><br />

      <label>
        <input
          type="checkbox"
          checked={isClosed}
          onChange={(e) => setIsClosed(e.target.checked)}
        />
        {" "}Zi închisă
      </label>

      <br /><br />

      <button onClick={saveOverride} disabled={loading}>
        {loading ? "Se salvează..." : "Salvează override"}
      </button>

      {message && <p style={{ marginTop: 8 }}>{message}</p>}
    </div>
  );
}

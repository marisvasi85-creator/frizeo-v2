"use client";

import { useEffect, useState } from "react";

export default function DayOverrideForm() {
  const [barberId, setBarberId] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/barber/profile")
      .then((r) => r.json())
      .then((data) => setBarberId(data.id));
  }, []);

  async function saveOverride() {
    if (!date || !barberId) {
      setMessage("Date invalide");
      return;
    }

    setLoading(true);
    setMessage("");

    const res = await fetch("/api/barber-overrides", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        barberId,
        date,
        is_closed: isClosed,
        work_start: isClosed ? null : start || null,
        work_end: isClosed ? null : end || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Eroare");
    } else {
      setMessage("Salvat ✔");
    }

    setLoading(false);
  }

  return (
    <div className="space-y-3 border p-4 rounded-xl">
      <h3 className="font-semibold">Override zi</h3>

<input
  type="date"
  value={date}
  onChange={(e) => setDate(e.target.value)}
  className="
    w-full
    bg-[#0F0F10]
    border
    border-white/10
    rounded-lg
    px-4
    py-3
    text-white
  "
/>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={isClosed}
          onChange={(e) => setIsClosed(e.target.checked)}
        />
        Zi liberă (concediu)
      </label>

      {!isClosed && (
        <>
<input
  type="time"
  value={start}
  onChange={(e) => setStart(e.target.value)}
  className="
    w-full
    bg-[#0F0F10]
    border
    border-white/10
    rounded-lg
    px-4
    py-3
    text-white
  "
/>
<input
  type="time"
  value={end}
  onChange={(e) => setEnd(e.target.value)}
  className="
    w-full
    bg-[#0F0F10]
    border
    border-white/10
    rounded-lg
    px-4
    py-3
    text-white
  "
/>
        </>
      )}

      <button onClick={saveOverride} className="
  bg-white
  text-black
  px-4
  py-3
  rounded-lg
  font-medium
">
        {loading ? "Se salvează..." : "Salvează"}
      </button>

      {message && <p>{message}</p>}
    </div>
  );
}
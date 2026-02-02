"use client";

import { useState } from "react";

type Slot = {
  start: string;
  end: string;
};

export default function RescheduleConfirm({
  token,
  date,
  slot,
}: {
  token: string;
  date: string;
  slot: Slot;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/bookings/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        new_date: date,
        new_start_time: slot.start,
        new_end_time: slot.end,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Eroare la reprogramare");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return <p className="text-green-600">Programare reprogramată ✔</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-red-500">{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded"
      >
        {loading ? "Se salvează..." : "Confirmă reprogramarea"}
      </button>
    </div>
  );
}

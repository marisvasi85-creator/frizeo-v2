"use client";

import { useState } from "react";

type Props = {
  token: string;
  date: string;
  start: string;
  end: string;
};

export default function RescheduleConfirm({
  token,
  date,
  start,
  end,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (loading) return; // 🔒 anti double click

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings/reschedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          new_date: date,
          new_start_time: start,
          new_end_time: end,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Eroare");
        setLoading(false);
        return;
      }

      // 🔥 REDIRECT DIRECT (FĂRĂ setTimeout)
      window.location.href = "/reschedule/confirmed";

    } catch (err) {
      console.error(err);
      setError("Eroare server");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* ERROR */}
      {error && (
        <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* PREVIEW */}
      <div className="border rounded-xl p-4 text-sm bg-white shadow-sm">
        <p className="font-medium mb-2">
          Confirmare nouă programare
        </p>

        <p>📅 {date}</p>
        <p>⏰ {start} - {end}</p>
      </div>

      {/* BUTTON */}
      <button
        onClick={handleConfirm}
        disabled={loading}
        className={`
          w-full p-4 rounded-xl font-medium transition
          ${
            loading
              ? "bg-gray-300 text-gray-500"
              : "bg-black text-white hover:opacity-90"
          }
        `}
      >
        {loading ? "Se procesează..." : "Confirmă reprogramarea"}
      </button>

    </div>
  );
}
"use client";

import { useEffect, useState } from "react";

export default function CancelClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 🔥 LOAD BOOKING INFO
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/bookings/by-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Link invalid");
        return;
      }

      setBooking(data);
    };

    if (token) load();
  }, [token]);

  // 🔥 CONFIRM CANCEL
  const handleCancel = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Eroare");
      setLoading(false);
      return;
    }

    // 🔥 redirect frumos
    window.location.href = "/cancel/confirmed";
  };

  // 🔴 ERROR
  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="border rounded-2xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Eroare</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // ⏳ LOADING
  if (!booking) {
    return (
      <div className="text-center mt-20">Se încarcă...</div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 space-y-6">

      {/* INFO */}
      <div className="border rounded-2xl p-6 shadow bg-gray-50">
        <h2 className="text-lg font-semibold mb-3">
          Confirmare anulare
        </h2>

        <p className="text-sm text-gray-600">
          Ești sigur că vrei să anulezi programarea?
        </p>

        <div className="mt-4 text-sm space-y-1">
          <p><b>📅</b> {booking.date}</p>
          <p><b>⏰</b> {booking.start_time}</p>
          <p><b>👤</b> {booking.client_name}</p>
        </div>
      </div>

      {/* BUTTON */}
      <button
        onClick={handleCancel}
        disabled={loading}
        className={`
          w-full p-4 rounded-xl font-medium transition
          ${
            loading
              ? "bg-gray-300 text-gray-500"
              : "bg-red-600 text-white hover:opacity-90"
          }
        `}
      >
        {loading ? "Se procesează..." : "Confirmă anularea"}
      </button>

    </div>
  );
}
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function CancelBookingPage() {
  const params = useSearchParams();
  const token = params.get("token");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function cancelBooking() {
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();

    if (res.ok) {
      setMessage(data.message);
    } else {
      setMessage(data.error || "Eroare");
    }

    setLoading(false);
  }

  if (!token) {
    return <p>Link de anulare invalid</p>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Anulare programare</h1>

      <button onClick={cancelBooking} disabled={loading}>
        {loading ? "Se anulează..." : "Anulează programarea"}
      </button>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}

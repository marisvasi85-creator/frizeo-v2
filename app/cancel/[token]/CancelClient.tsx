"use client";

import { useState } from "react";

type Props = {
  token: string;
};

export default function CancelClient({ token }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function cancelBooking() {
    setLoading(true);

    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.message || "Anularea nu a reușit");
      setLoading(false);
      return;
    }

    setMessage("Programarea a fost anulată cu succes");
    setLoading(false);
  }

  // ✅ DOAR componenta returnează JSX
  return (
    <div style={{ padding: 40 }}>
      <h2>Anulare programare</h2>

      {!message ? (
        <button onClick={cancelBooking} disabled={loading}>
          {loading ? "Se anulează..." : "Confirmă anularea"}
        </button>
      ) : (
        <p>{message}</p>
      )}
    </div>
  );
}

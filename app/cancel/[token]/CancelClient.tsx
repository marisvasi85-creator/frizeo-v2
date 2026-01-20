"use client";

import { useEffect, useState } from "react";

type Props = {
  token: string;
};

export default function CancelClient({ token }: Props) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function cancelBooking() {
      try {
        const res = await fetch("/api/bookings/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
console.log("TOKEN PAGE:", token);

        if (!res.ok) {
          setMessage(data.error || "Eroare la anulare");
        } else {
          setMessage(data.message || "Programarea a fost anulată");
        }
      } catch {
        setMessage("Eroare server");
      } finally {
        setLoading(false);
      }
    }

    cancelBooking();
  }, [token]);

  if (loading) {
    return <p>Se procesează anularea...</p>;
  }

  return (
    <div style={{ maxWidth: 400 }}>
      <h2>Anulare programare</h2>
      <p>{message}</p>
    </div>
  );
}

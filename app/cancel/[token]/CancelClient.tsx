"use client";

import { useEffect, useState } from "react";

export default function CancelClient({ token }: { token: string }) {
  const [status, setStatus] = useState("Se procesează...");

  useEffect(() => {
    const cancel = async () => {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || "Eroare");
        return;
      }

      setStatus("Programarea a fost anulată");
    };

    if (token) cancel();
  }, [token]);

  return (
    <div className="max-w-md mx-auto mt-20 text-center border rounded-2xl p-6 shadow">
      <h2 className="text-xl font-semibold mb-4">Anulare programare</h2>
      <p>{status}</p>
    </div>
  );
}
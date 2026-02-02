"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function CancelBookingPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function cancel() {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Eroare la anulare");
      } else {
        setSuccess(true);
      }

      setLoading(false);
    }

    cancel();
  }, [token]);

  if (loading) return <p>Se anulează programarea…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold">Programare anulată</h1>
      <p>Programarea ta a fost anulată cu succes.</p>
    </div>
  );
}

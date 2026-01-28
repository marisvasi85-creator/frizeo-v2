"use client";

import { useEffect, useState } from "react";

type Override = {
  id: string;
  date: string;
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
};

export default function OverrideList() {
  // ⚠️ TEMPORAR hardcoded – exact ca în DefaultSchedule
  const barberId = "d0bc5fec-f37a-4e8a-94ab-b3ef9880374c";

  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/barber-overrides?barberId=${barberId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOverrides(data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Se încarcă override-urile...</p>;

  if (overrides.length === 0) {
    return <p>Nu există override-uri definite.</p>;
  }

  return (
    <ul style={{ fontSize: 14 }}>
      {overrides.map((o) => (
        <li key={o.id}>
          📅 {o.date} —{" "}
          {o.is_closed
            ? "Zi închisă"
            : `${o.start_time} – ${o.end_time}`}
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useEffect, useState } from "react";

type Override = {
  id: string;
  date: string;
  is_closed: boolean;
  break_start?: string | null;
  break_end?: string | null;
};

export default function OverridesCalendar({ barberId }: { barberId: string }) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverrides() {
      try {
        const res = await fetch(`/api/admin/overrides?barberId=${barberId}`);
        const data = await res.json();
        setOverrides(data || []);
      } catch (err) {
        console.error("Error loading overrides:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOverrides();
  }, [barberId]);

  if (loading) return <div>Loading overrides...</div>;

  return (
    <div style={{ marginTop: 20 }}>
      <h3>Override zile</h3>

      {overrides.length === 0 && <p>Nu există override-uri.</p>}

      {overrides.map((o) => (
        <div
          key={o.id}
          style={{
            padding: 10,
            marginBottom: 10,
            border: "1px solid #ddd",
            borderRadius: 6,
          }}
        >
          <strong>{o.date}</strong>
          <br />
          {o.is_closed ? "Închis" : "Deschis"}
          {o.break_start && (
            <>
              <br />
              Pauză: {o.break_start} - {o.break_end}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
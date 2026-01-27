"use client";

import { useEffect, useState } from "react";
import OverrideModal from "../barber/components/OverrideModal";
import type { Override } from "@/app/types/override";


type Props = {
  barberId: string;
  tenantId: string;
};

export default function OverridesCalendar({ barberId, tenantId }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [overrides, setOverrides] = useState<Override[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  /* ================= LOAD OVERRIDES ================= */
  useEffect(() => {
    setLoading(true);

    fetch(
      `/api/barber-overrides?barberId=${barberId}&tenantId=${tenantId}&year=${year}&month=${month + 1}`
    )
      .then((res) => res.json())
      .then((data) => {
        setOverrides(data.overrides || []);
      })
      .finally(() => setLoading(false));
  }, [barberId, tenantId, year, month]);

  const getOverrideForDay = (date: string) =>
    overrides.find((o) => o.date === date);

  const formatDate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;

  /* ================= UI ================= */
  return (
    <div style={{ padding: 24 }}>
      <h2>Override program (zile libere / speciale)</h2>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() =>
          setCurrentMonth(new Date(year, month - 1, 1))
        }>
          ◀
        </button>

        <strong style={{ margin: "0 12px" }}>
          {currentMonth.toLocaleString("ro-RO", {
            month: "long",
            year: "numeric",
          })}
        </strong>

        <button onClick={() =>
          setCurrentMonth(new Date(year, month + 1, 1))
        }>
          ▶
        </button>
      </div>

      {loading && <p>Se încarcă…</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8,
          marginTop: 16,
        }}
      >
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = formatDate(day);
          const override = getOverrideForDay(date);

          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              style={{
                padding: 12,
                borderRadius: 6,
                border: "1px solid #333",
                background: override
                  ? override.is_closed
                    ? "#ff4d4d"
                    : "#ffd966"
                  : "#111",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <OverrideModal
          barberId={barberId}
          date={selectedDate}
          existingOverride={getOverrideForDay(selectedDate) || null}
          onClose={() => setSelectedDate(null)}
          onSaved={() => {
            setSelectedDate(null);
            // reload
            fetch(
              `/api/barber-overrides?barberId=${barberId}&tenantId=${tenantId}&year=${year}&month=${month + 1}`
            )
              .then((res) => res.json())
              .then((data) => setOverrides(data.overrides || []));
          }}
        />
      )}
    </div>
  );
}

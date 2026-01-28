"use client";

import { useEffect, useState } from "react";

const DAYS = [
  { id: 1, label: "Luni" },
  { id: 2, label: "Marți" },
  { id: 3, label: "Miercuri" },
  { id: 4, label: "Joi" },
  { id: 5, label: "Vineri" },
  { id: 6, label: "Sâmbătă" },
  { id: 7, label: "Duminică" },
];

type Day = {
  day_of_week: number;
  is_working: boolean;
  start_time: string | null;
  end_time: string | null;
  break_enabled: boolean;
  break_start: string | null;
  break_end: string | null;
};

export default function WeeklyScheduleEditor() {
  const barberId = "d0bc5fec-f37a-4e8a-94ab-b3ef9880374c"; // TEMP

  const [days, setDays] = useState<Day[]>([]);

  useEffect(() => {
    fetch(`/api/barber-weekly-schedule?barberId=${barberId}`)
      .then((res) => res.json())
      .then((data) => setDays(data));
  }, []);

  function updateDay(day: Day, changes: Partial<Day>) {
    const updated = { ...day, ...changes };

    fetch("/api/barber-weekly-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: barberId,
        ...updated,
      }),
    });

    setDays((prev) =>
      prev.map((d) => (d.day_of_week === day.day_of_week ? updated : d))
    );
  }

  return (
    <div>
      <h2>🗓 Program săptămânal</h2>

      {DAYS.map((d) => {
        const day =
          days.find((x) => x.day_of_week === d.id) ||
          ({
            day_of_week: d.id,
            is_working: false,
            start_time: null,
            end_time: null,
            break_enabled: false,
            break_start: null,
            break_end: null,
          } as Day);

        return (
          <div key={d.id} style={{ borderBottom: "1px solid #ddd", padding: 12 }}>
            <strong>{d.label}</strong>

            <div>
              <label>
                <input
                  type="checkbox"
                  checked={day.is_working}
                  onChange={(e) =>
                    updateDay(day, { is_working: e.target.checked })
                  }
                />
                Lucrează
              </label>
            </div>

            {day.is_working && (
              <>
                <div>
                  <input
                    type="time"
                    value={day.start_time || ""}
                    onChange={(e) =>
                      updateDay(day, { start_time: e.target.value })
                    }
                  />
                  {" - "}
                  <input
                    type="time"
                    value={day.end_time || ""}
                    onChange={(e) =>
                      updateDay(day, { end_time: e.target.value })
                    }
                  />
                </div>

                <label>
                  <input
                    type="checkbox"
                    checked={day.break_enabled}
                    onChange={(e) =>
                      updateDay(day, { break_enabled: e.target.checked })
                    }
                  />
                  Pauză
                </label>

                {day.break_enabled && (
                  <div>
                    <input
                      type="time"
                      value={day.break_start || ""}
                      onChange={(e) =>
                        updateDay(day, { break_start: e.target.value })
                      }
                    />
                    {" - "}
                    <input
                      type="time"
                      value={day.break_end || ""}
                      onChange={(e) =>
                        updateDay(day, { break_end: e.target.value })
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

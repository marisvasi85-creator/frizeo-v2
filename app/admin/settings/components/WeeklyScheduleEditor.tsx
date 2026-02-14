"use client";

import { useEffect, useState } from "react";

type DaySchedule = {
  day_of_week: number;
  is_working: boolean;
  work_start: string | null;
  work_end: string | null;
  break_enabled: boolean;
  break_start: string | null;
  break_end: string | null;
};

const DAYS = [
  { id: 1, label: "Luni" },
  { id: 2, label: "Marți" },
  { id: 3, label: "Miercuri" },
  { id: 4, label: "Joi" },
  { id: 5, label: "Vineri" },
  { id: 6, label: "Sâmbătă" },
  { id: 7, label: "Duminică" },
];

export default function WeeklyScheduleEditor({
  barberId,
}: {
  barberId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DaySchedule[]>([]);

  /* =========================
     LOAD WEEKLY SCHEDULE
  ========================= */
  useEffect(() => {
    setLoading(true);

    fetch(`/api/barber-weekly-schedule?barberId=${barberId}`)
      .then((res) => res.json())
      .then((data) => {
        setDays(data || []);
      })
      .finally(() => setLoading(false));
  }, [barberId]);

  /* =========================
     UPDATE DAY
  ========================= */
  function updateDay(
    day: number,
    patch: Partial<DaySchedule>
  ) {
    setDays((prev) =>
      prev.map((d) =>
        d.day_of_week === day ? { ...d, ...patch } : d
      )
    );
  }

  /* =========================
     SAVE ALL
  ========================= */
  async function save() {
    setLoading(true);

    const res = await fetch("/api/barber-weekly-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: barberId,
        days,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      alert("Eroare la salvare program");
      return;
    }

    alert("Program salvat");
  }

  if (loading) return <p>Se încarcă…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {DAYS.map((day) => {
        const data =
          days.find((d) => d.day_of_week === day.id) ||
          {
            day_of_week: day.id,
            is_working: false,
            work_start: null,
            work_end: null,
            break_enabled: false,
            break_start: null,
            break_end: null,
          };

        return (
          <div
            key={day.id}
            style={{
              border: "1px solid #ddd",
              padding: 10,
              borderRadius: 6,
            }}
          >
            <strong>{day.label}</strong>

            <label style={{ marginLeft: 12 }}>
              <input
                type="checkbox"
                checked={data.is_working}
                onChange={(e) =>
                  updateDay(day.id, {
                    is_working: e.target.checked,
                  })
                }
              />{" "}
              Lucrez
            </label>

            {data.is_working && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="time"
                  value={data.work_start || ""}
                  onChange={(e) =>
                    updateDay(day.id, {
                      work_start: e.target.value,
                    })
                  }
                />
                {" - "}
                <input
                  type="time"
                  value={data.work_end || ""}
                  onChange={(e) =>
                    updateDay(day.id, {
                      work_end: e.target.value,
                    })
                  }
                />

                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={data.break_enabled}
                      onChange={(e) =>
                        updateDay(day.id, {
                          break_enabled: e.target.checked,
                        })
                      }
                    />{" "}
                    Pauză
                  </label>
                </div>

                {data.break_enabled && (
                  <>
                    <input
                      type="time"
                      value={data.break_start || ""}
                      onChange={(e) =>
                        updateDay(day.id, {
                          break_start: e.target.value,
                        })
                      }
                    />
                    {" - "}
                    <input
                      type="time"
                      value={data.break_end || ""}
                      onChange={(e) =>
                        updateDay(day.id, {
                          break_end: e.target.value,
                        })
                      }
                    />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button onClick={save} style={{ marginTop: 12 }}>
        Salvează programul
      </button>
    </div>
  );
}

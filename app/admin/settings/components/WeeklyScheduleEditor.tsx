"use client";

import { useState } from "react";
import { saveWeeklySchedule } from "../actions";

type Day = {
  day_of_week: number;
  is_working: boolean;
  work_start: string | null;
  work_end: string | null;
  break_enabled: boolean;
  break_start: string | null;
  break_end: string | null;
};

type Props = {
  initialData: Day[];
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

export default function WeeklyScheduleEditor({ initialData }: Props) {
  const [loading, setLoading] = useState(false);

  // 🔥 MAP DB → UI
  const [days, setDays] = useState<Day[]>(
    DAYS.map((d) => {
      const existing = initialData.find(
        (x) => x.day_of_week === d.id
      );

      return (
        existing || {
          day_of_week: d.id,
          is_working: false,
          work_start: "09:00",
          work_end: "18:00",
          break_enabled: false,
          break_start: "13:00",
          break_end: "14:00",
        }
      );
    })
  );

  function updateDay(index: number, field: keyof Day, value: any) {
    const updated = [...days];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setDays(updated);
  }

  async function handleSave() {
    setLoading(true);

    await saveWeeklySchedule(days);

    // NU mai punem setLoading(false)
    // redirect oprește execuția
  }

  return (
    <div className="space-y-6">

      {/* LIST */}
      <div className="space-y-3">
        {days.map((day, index) => (
          <div
            key={day.day_of_week}
            className="bg-[#161618] border border-white/10 p-4 rounded-xl space-y-4"
          >

            {/* HEADER */}
            <div className="flex justify-between items-center">

              <span className="font-medium">
                {DAYS[index].label}
              </span>

              <button
                onClick={() =>
                  updateDay(index, "is_working", !day.is_working)
                }
                className={`px-3 py-1 rounded text-sm ${
                  day.is_working
                    ? "bg-green-500 text-black"
                    : "bg-gray-700 text-white"
                }`}
              >
                {day.is_working ? "Lucrează" : "Liber"}
              </button>
            </div>

            {/* WORK HOURS */}
            {day.is_working && (
              <div className="flex flex-wrap gap-2">

                <input
                  type="time"
                  value={day.work_start || ""}
                  onChange={(e) =>
                    updateDay(index, "work_start", e.target.value)
                  }
                  className="bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
                />

                <input
                  type="time"
                  value={day.work_end || ""}
                  onChange={(e) =>
                    updateDay(index, "work_end", e.target.value)
                  }
                  className="bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
                />

              </div>
            )}

            {/* BREAK */}
            {day.is_working && (
              <div className="space-y-2">

                <button
                  onClick={() =>
                    updateDay(
                      index,
                      "break_enabled",
                      !day.break_enabled
                    )
                  }
                  className="text-sm text-white/70"
                >
                  {day.break_enabled
                    ? "✔ Pauză activă"
                    : "Adaugă pauză"}
                </button>

                {day.break_enabled && (
                  <div className="flex gap-2">

                    <input
                      type="time"
                      value={day.break_start || ""}
                      onChange={(e) =>
                        updateDay(
                          index,
                          "break_start",
                          e.target.value
                        )
                      }
                      className="bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
                    />

                    <input
                      type="time"
                      value={day.break_end || ""}
                      onChange={(e) =>
                        updateDay(
                          index,
                          "break_end",
                          e.target.value
                        )
                      }
                      className="bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
                    />

                  </div>
                )}
              </div>
            )}

          </div>
        ))}
      </div>

      {/* SAVE */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-white text-black px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          {loading ? "Se salvează..." : "Salvează"}
        </button>
      </div>

    </div>
  );
}
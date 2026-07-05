"use client";

import { useState } from "react";
import { saveWeeklySchedule } from "../actions";
import AdminButton from "../../components/AdminButton";

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

function normTime(t: string | null | undefined) {
  if (!t) return null;
  return t.slice(0, 5);
}

function normalizeDay(existing: Day): Day {
  return {
    ...existing,
    work_start: normTime(existing.work_start),
    work_end: normTime(existing.work_end),
    break_start: normTime(existing.break_start),
    break_end: normTime(existing.break_end),
  };
}

export default function WeeklyScheduleEditor({ initialData }: Props) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState<Day[]>(
    DAYS.map((d) => {
      const existing = initialData.find(
        (x) => x.day_of_week === d.id
      );

      return existing
        ? normalizeDay(existing)
        : {
            day_of_week: d.id,
            is_working: false,
            work_start: "09:00",
            work_end: "18:00",
            break_enabled: false,
            break_start: "13:00",
            break_end: "14:00",
          };
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

  // 🔥 TOGGLE PAUZĂ (CORECT)
  function toggleBreak(index: number) {
    const updated = [...days];

    const enabled = !updated[index].break_enabled;
    updated[index].break_enabled = enabled;

    if (enabled) {
      // default values
      updated[index].break_start =
        updated[index].break_start || "13:00";
      updated[index].break_end =
        updated[index].break_end || "14:00";
    } else {
      // 🔥 IMPORTANT: ștergem pauza
      updated[index].break_start = null;
      updated[index].break_end = null;
    }

    setDays(updated);
  }

  async function handleSave() {
    for (const day of days) {
      if (!day.is_working) continue;

      if (!day.work_start || !day.work_end) {
        alert("Completează orele de lucru");
        return;
      }

      if (day.work_start >= day.work_end) {
        alert("Ora de început trebuie să fie mai mică decât ora de final");
        return;
      }

      if (day.break_enabled) {
        if (!day.break_start || !day.break_end) {
          alert("Completează pauza");
          return;
        }

        if (day.break_start >= day.break_end) {
          alert("Pauza este invalidă");
          return;
        }

        if (
          day.break_start < day.work_start ||
          day.break_end > day.work_end
        ) {
          alert("Pauza trebuie să fie în intervalul programului");
          return;
        }
      }
    }

    setLoading(true);
    setSaved(false);
    setError("");

    const result = await saveWeeklySchedule(days);

    if (!result.success) {
      setError(result.error || "Nu s-a putut salva programul.");
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
  }

  return (
    <div className="space-y-6">

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
              <div className="flex gap-2">

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
                  type="button"
                  onClick={() => toggleBreak(index)}
                  className={`text-sm ${
                    day.break_enabled
                      ? "text-green-400"
                      : "text-white/60"
                  }`}
                >
                  {day.break_enabled
                    ? "✔ Pauză activă (click pentru eliminare)"
                    : "+ Adaugă pauză"}
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
      <div className="flex justify-end items-center gap-3">

  {error && (
    <div className="text-red-400 text-sm">{error}</div>
  )}

  {saved && !error && (
    <div className="text-green-400 text-sm">
      Program salvat ✔
    </div>
  )}

  <AdminButton
    onClick={handleSave}
    disabled={loading}
    loading={loading}
    loadingLabel="Se salvează..."
    size="sm"
  >
    Salvează
  </AdminButton>

</div>

    </div>
  );
}
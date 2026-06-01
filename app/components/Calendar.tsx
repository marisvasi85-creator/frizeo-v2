"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

// 🔥 LOCAL DATE SAFE (fără UTC bug)
function toLocalISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 🔥 DISABLE ZILE
function isDayDisabled(date: Date, weeklySchedule: any[], overrides: any[]) {
  const jsDay = date.getDay();
  const day = jsDay === 0 ? 7 : jsDay;

  const iso = toLocalISO(date);

  const schedule = weeklySchedule.find((s: any) => s.day_of_week === day);
  const override = overrides.find((o: any) => o.date === iso);

  if (override?.is_closed) return true;
  if (!schedule?.is_working) return true;

  return false;
}

export default function Calendar({
  value,
  onChange,
  weeklySchedule = [],
  overrides = [],
  availableDays = [],
}: any) {
  return (
    <div className="flex justify-center mb-6">
      <DayPicker
        mode="single"
        selected={value ? new Date(value) : undefined}
        onSelect={(date) => {
          if (!date) return;
          onChange(toLocalISO(date));
        }}
        disabled={(date) =>
          isDayDisabled(date, weeklySchedule, overrides)
        }
        modifiers={{
          hasSlots: (date) => {
            const iso = toLocalISO(date);
            return availableDays.includes(iso);
          },
        }}
        modifiersClassNames={{
          hasSlots: "bg-green-200 text-black rounded-full",
        }}
      />
    </div>
  );
}
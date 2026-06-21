"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

import { hasCustomOverrideHours } from "@/lib/schedule/resolveDaySchedule";

function toLocalISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

        disabled={(date) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (date < today) return true;

          if (!weeklySchedule || weeklySchedule.length === 0) {
            return false;
          }

          const jsDay = date.getDay();
          const day = jsDay === 0 ? 7 : jsDay;

          const iso = toLocalISO(date);

          const schedule = weeklySchedule.find(
            (s: any) => s.day_of_week === day
          );

          const override = overrides.find((o: any) => o.date === iso);

          if (override?.is_closed) return true;

          if (hasCustomOverrideHours(override)) return false;

          if (!schedule?.is_working) return true;

          return false;
        }}

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
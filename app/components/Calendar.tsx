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

function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function Calendar({
  value,
  onChange,
  weeklySchedule = [],
  overrides = [],
  availableDays = [],
  allowDates = [],
  enforceAvailableDays = false,
}: any) {
  return (
    <div className="flex justify-center mb-6">
      <DayPicker
        mode="single"
        defaultMonth={value ? parseLocalDate(value) : undefined}
        selected={value ? parseLocalDate(value) : undefined}
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

          if (allowDates.includes(iso)) return false;

          if (
            enforceAvailableDays &&
            availableDays.length > 0 &&
            !availableDays.includes(iso)
          ) {
            return true;
          }

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
          hasSlots: "rdp-day_has-slots",
          selected: "rdp-day_selected-custom",
        }}
        modifiersStyles={{
          hasSlots: {
            backgroundColor: "rgba(16, 185, 129, 0.45)",
            color: "#ffffff",
            fontWeight: 600,
            borderRadius: "9999px",
          },
          selected: {
            backgroundColor: "#ffffff",
            color: "#000000",
            borderRadius: "9999px",
          },
        }}
      />
    </div>
  );
}
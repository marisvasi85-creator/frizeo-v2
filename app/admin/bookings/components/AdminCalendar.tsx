"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

function toLocalISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AdminCalendar({
  value,
  onChange,
  availableDays,
}: {
  value: string;
  onChange: (d: string) => void;
  availableDays: string[];
}) {
  return (
    <DayPicker
      mode="single"
      selected={new Date(value)}
      onSelect={(date) => {
        if (!date) return;
        onChange(toLocalISO(date));
      }}

      // 🔥 DISABLE zile fără sloturi
      disabled={(date) => {
        const iso = toLocalISO(date);
        return !availableDays.includes(iso);
      }}

      // 🔥 HIGHLIGHT zile OK
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
  );
}
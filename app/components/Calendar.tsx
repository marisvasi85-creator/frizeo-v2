"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

export default function Calendar({ value, onChange }: any) {
  return (
    <div className="flex justify-center mb-6">
      <DayPicker
        mode="single"
        selected={value ? new Date(value) : undefined}
        onSelect={(date) => {
          if (!date) return;

          const fixed = new Date(date);
          fixed.setHours(12, 0, 0, 0);

          // 🔥 FIX FINAL
          const iso = fixed.toISOString().split("T")[0];

          onChange(iso);
        }}
      />
    </div>
  );
}
"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

export default function BookingCalendar({
  selected,
  onSelect,
}: {
  selected?: Date;
  onSelect: (d: Date | undefined) => void;
}) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}
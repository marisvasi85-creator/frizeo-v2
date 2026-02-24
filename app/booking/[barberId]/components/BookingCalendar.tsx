"use client";

import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/dist/style.css";

type Props = {
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  availability: Record<string, boolean>;
};

export default function BookingCalendar({
  selected,
  onSelect,
  availability,
}: Props) {
  const today = new Date();

  const disabledDates: Date[] = [];
  const availableDates: Date[] = [];

  Object.entries(availability).forEach(([dateStr, available]) => {
    const d = new Date(dateStr + "T00:00:00");
    if (!available) disabledDates.push(d);
    else availableDates.push(d);
  });

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-6">
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={onSelect}
        disabled={[
          { before: today },
          ...disabledDates,
        ]}
        modifiers={{
          available: availableDates,
        }}
        modifiersClassNames={{
          available: "relative after:absolute after:bottom-1 after:w-1.5 after:h-1.5 after:bg-green-500 after:rounded-full",
        }}
        classNames={{
          months: "flex flex-col",
          month: "space-y-4",
          caption: "flex justify-center items-center text-lg font-semibold",
          nav: "flex items-center gap-2",
          nav_button:
            "h-8 w-8 rounded-full hover:bg-gray-100 transition flex items-center justify-center",
          table: "w-full border-collapse",
          head_row: "flex",
          head_cell:
            "text-xs font-medium text-gray-400 w-10 text-center",
          row: "flex w-full mt-2",
          cell: "relative h-10 w-10 text-center text-sm",
          day: "h-10 w-10 rounded-full transition flex items-center justify-center hover:bg-gray-100",
          day_selected:
            "bg-black text-white hover:bg-black",
          day_today:
            "border border-black",
          day_disabled:
            "text-gray-300 cursor-not-allowed",
        }}
      />
    </div>
  );
}
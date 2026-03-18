"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ro } from "date-fns/locale";

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [direction, setDirection] = useState<"left" | "right">("right");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = [];
  let day = startDate;

  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function changeMonth(offset: number) {
    setDirection(offset > 0 ? "right" : "left");
    setCurrentMonth(addMonths(currentMonth, offset));
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 w-full max-w-md transition-all duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <button
          onClick={() => changeMonth(-1)}
          className="p-2 rounded-full hover:bg-gray-100 transition"
        >
          ←
        </button>

        <h2 className="text-xl font-semibold capitalize tracking-tight">
          {format(currentMonth, "LLLL yyyy", { locale: ro })}
        </h2>

        <button
          onClick={() => changeMonth(1)}
          className="p-2 rounded-full hover:bg-gray-100 transition"
        >
          →
        </button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 text-xs text-gray-400 mb-3">
        {["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"].map((d) => (
          <div key={d} className="text-center font-medium tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div
        key={currentMonth.toISOString()}
        className={`grid grid-cols-7 gap-y-3 transition-all duration-300 ${
          direction === "right" ? "animate-slideRight" : "animate-slideLeft"
        }`}
      >
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const isAvailable = availability[key];
          const isDisabled =
            day < today ||
            isAvailable === false ||
            !isSameMonth(day, monthStart);

          const isSelected = selected && isSameDay(day, selected);

          return (
            <button
              key={i}
              disabled={isDisabled}
              onClick={() => onSelect(day)}
              className={`
                relative h-11 w-11 mx-auto rounded-full flex items-center justify-center
                text-sm transition-all duration-200
                ${!isSameMonth(day, monthStart) ? "text-gray-300" : ""}
                ${
                  isSelected
                    ? "bg-black text-white shadow-md scale-105"
                    : "hover:bg-gray-100"
                }
                ${isDisabled ? "cursor-not-allowed opacity-30" : ""}
              `}
            >
              {format(day, "d")}

              {/* Today ring */}
              {isToday(day) && !isSelected && (
                <span className="absolute inset-0 rounded-full border border-black/30" />
              )}

              {/* Availability dot */}
              {isAvailable && isSameMonth(day, monthStart) && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full shadow-sm" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
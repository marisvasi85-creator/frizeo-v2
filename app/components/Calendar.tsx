"use client";

import { useMemo, useState } from "react";

type Props = {
  value: string | null;                // YYYY-MM-DD
  onChange: (date: string) => void;
  availableDays?: string[];            // ["2026-02-05", "2026-02-07"]
  minDate?: string;
  maxDate?: string;
};

const WEEK_DAYS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sa", "Du"];

function toISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export default function Calendar({
  value,
  onChange,
  availableDays = [],
  minDate,
  maxDate,
}: Props) {
  const todayISO = toISO(new Date());

  const [currentMonth, setCurrentMonth] = useState(() =>
    value ? new Date(value) : new Date()
  );

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const startOffset = (start.getDay() + 6) % 7;
    const result: { date: Date; isCurrentMonth: boolean }[] = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      result.push({
        date: new Date(start.getFullYear(), start.getMonth(), -i),
        isCurrentMonth: false,
      });
    }

    for (let d = 1; d <= end.getDate(); d++) {
      result.push({
        date: new Date(start.getFullYear(), start.getMonth(), d),
        isCurrentMonth: true,
      });
    }

    while (result.length % 7 !== 0) {
      const last = result[result.length - 1].date;
      result.push({
        date: new Date(
          last.getFullYear(),
          last.getMonth(),
          last.getDate() + 1
        ),
        isCurrentMonth: false,
      });
    }

    return result;
  }, [currentMonth]);

  function canSelect(date: Date) {
    const iso = toISO(date);
    if (minDate && iso < minDate) return false;
    if (maxDate && iso > maxDate) return false;
    return true;
  }

  return (
    <div className="w-full max-w-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() =>
            setCurrentMonth(
              new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() - 1,
                1
              )
            )
          }
          className="px-2 text-lg"
        >
          ←
        </button>

        <div className="font-semibold capitalize">
          {currentMonth.toLocaleDateString("ro-RO", {
            month: "long",
            year: "numeric",
          })}
        </div>

        <button
          onClick={() =>
            setCurrentMonth(
              new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() + 1,
                1
              )
            )
          }
          className="px-2 text-lg"
        >
          →
        </button>
      </div>

      {/* WEEK DAYS */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK_DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-gray-500"
          >
            {d}
          </div>
        ))}
      </div>

      {/* DAYS */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, isCurrentMonth }) => {
          const iso = toISO(date);
          const isSelected = value === iso;
          const isToday = iso === todayISO;
          const hasSlots = availableDays.includes(iso);
          const selectable = isCurrentMonth && canSelect(date);

          return (
            <button
              key={iso}
              disabled={!selectable}
              onClick={() => onChange(iso)}
              className={`
                relative h-10 rounded border text-sm
                ${!isCurrentMonth ? "text-gray-400 border-transparent" : ""}
                ${!selectable ? "opacity-40 cursor-not-allowed" : ""}
                ${isSelected ? "bg-black text-white" : ""}
                ${!isSelected && isToday ? "border-blue-500" : ""}
                ${!isSelected && !isToday ? "hover:bg-gray-100" : ""}
              `}
            >
              {date.getDate()}

              {/* DOT = zi cu sloturi */}
              {hasSlots && isCurrentMonth && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

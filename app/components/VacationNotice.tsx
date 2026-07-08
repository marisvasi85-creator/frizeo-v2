"use client";

import type { VacationPeriod } from "@/lib/schedule/vacationPeriods";
import { formatVacationPeriodRO } from "@/lib/schedule/vacationPeriods";

export default function VacationNotice({
  periods,
  className = "",
}: {
  periods: VacationPeriod[];
  className?: string;
}) {
  if (!periods.length) return null;

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
    >
      <p className="font-medium">Concediu</p>
      <ul className="mt-1 space-y-0.5 text-amber-800">
        {periods.map((period) => (
          <li key={period.id}>
            {formatVacationPeriodRO(period)}
            {period.dayCount > 1 && (
              <span className="text-amber-700/80"> ({period.dayCount} zile)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

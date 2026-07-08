import { addDaysToDateString } from "@/lib/bookings/bookingTimezone";
import { vacationPeriodIdFromRange } from "@/lib/supabase/barberOverrideSchema";

export type VacationPeriod = {
  id: string;
  from: string;
  to: string;
  dayCount: number;
};

type OverrideRow = {
  date: string;
  is_closed: boolean;
  vacation_period_id?: string | null;
};

export function enumerateDateRange(from: string, to: string): string[] {
  if (from > to) return [];

  const dates: string[] = [];
  let current = from;

  while (current <= to) {
    dates.push(current);
    current = addDaysToDateString(current, 1);
  }

  return dates;
}

function groupConsecutiveClosedVacations(
  overrides: OverrideRow[],
): VacationPeriod[] {
  const closedDates = [
    ...new Set(
      overrides
        .filter((row) => row.is_closed && !row.vacation_period_id)
        .map((row) => row.date),
    ),
  ].sort();

  if (closedDates.length < 2) return [];

  const periods: VacationPeriod[] = [];
  let runStart = closedDates[0];
  let previous = closedDates[0];

  for (let i = 1; i < closedDates.length; i++) {
    const current = closedDates[i];
    const expectedNext = addDaysToDateString(previous, 1);

    if (current !== expectedNext) {
      const dayCount = enumerateDateRange(runStart, previous).length;
      if (dayCount >= 2) {
        periods.push({
          id: vacationPeriodIdFromRange(runStart, previous),
          from: runStart,
          to: previous,
          dayCount,
        });
      }
      runStart = current;
    }

    previous = current;
  }

  const dayCount = enumerateDateRange(runStart, previous).length;
  if (dayCount >= 2) {
    periods.push({
      id: vacationPeriodIdFromRange(runStart, previous),
      from: runStart,
      to: previous,
      dayCount,
    });
  }

  return periods;
}

export function groupVacationPeriods(
  overrides: OverrideRow[],
): VacationPeriod[] {
  const byPeriod = new Map<string, string[]>();

  for (const row of overrides) {
    if (!row.is_closed || !row.vacation_period_id) continue;

    const dates = byPeriod.get(row.vacation_period_id) ?? [];
    dates.push(row.date);
    byPeriod.set(row.vacation_period_id, dates);
  }

  const periods: VacationPeriod[] = [];

  for (const [id, dates] of byPeriod) {
    const sorted = [...dates].sort();
    periods.push({
      id,
      from: sorted[0],
      to: sorted[sorted.length - 1],
      dayCount: sorted.length,
    });
  }

  const consecutive = groupConsecutiveClosedVacations(overrides);

  for (const period of consecutive) {
    const overlaps = periods.some(
      (existing) =>
        existing.from <= period.to && existing.to >= period.from,
    );
    if (!overlaps) {
      periods.push(period);
    }
  }

  return periods.sort((a, b) => a.from.localeCompare(b.from));
}

export function vacationPeriodCoversDate(
  periods: VacationPeriod[],
  date: string,
): boolean {
  return periods.some((period) => date >= period.from && date <= period.to);
}

export function formatVacationPeriodRO(period: VacationPeriod): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "short",
      year:
        period.from.slice(0, 4) !== period.to.slice(0, 4)
          ? "numeric"
          : undefined,
    });
  };

  if (period.from === period.to) {
    return fmt(period.from);
  }

  return `${fmt(period.from)} – ${fmt(period.to)}`;
}

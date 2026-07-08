import { addDaysToDateString } from "@/lib/bookings/bookingTimezone";

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

  return periods.sort((a, b) => a.from.localeCompare(b.from));
}

export function formatVacationPeriodRO(period: VacationPeriod): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "short",
      year: period.from.slice(0, 4) !== period.to.slice(0, 4) ? "numeric" : undefined,
    });
  };

  if (period.from === period.to) {
    return fmt(period.from);
  }

  return `${fmt(period.from)} – ${fmt(period.to)}`;
}

import { DateInterval } from "./buildWorkIntervals";

/**
 * Elimină pauza din intervalele de lucru.
 * Dacă pauza nu există sau e invalidă → returnează intervalele originale.
 */
export function subtractBreak(
  intervals: DateInterval[],
  date: string,
  breakStart: string | null,
  breakEnd: string | null
): DateInterval[] {
  console.log("☕ subtractBreak()", {
    intervals,
    date,
    breakStart,
    breakEnd,
  });

  // 👉 fără pauză → nu modificăm nimic
  if (!breakStart || !breakEnd) {
    return intervals;
  }

  const breakStartDate = new Date(`${date}T${breakStart}`);
  const breakEndDate = new Date(`${date}T${breakEnd}`);

  if (
    isNaN(breakStartDate.getTime()) ||
    isNaN(breakEndDate.getTime()) ||
    breakEndDate <= breakStartDate
  ) {
    console.log("⛔ Pauză invalidă, ignorată");
    return intervals;
  }

  const result: DateInterval[] = [];

  for (const interval of intervals) {
    // 👉 pauza nu intersectează intervalul
    if (
      breakEndDate <= interval.start ||
      breakStartDate >= interval.end
    ) {
      result.push(interval);
      continue;
    }

    // 👉 înainte de pauză
    if (breakStartDate > interval.start) {
      result.push({
        start: interval.start,
        end: breakStartDate,
      });
    }

    // 👉 după pauză
    if (breakEndDate < interval.end) {
      result.push({
        start: breakEndDate,
        end: interval.end,
      });
    }
  }

  console.log("☕ intervals after break:", result);
  return result;
}

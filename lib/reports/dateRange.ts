import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";

export type ReportsRangePreset = "today" | "7d" | "30d" | "month";

export const REPORTS_RANGE_PRESETS: Array<{
  value: ReportsRangePreset;
  label: string;
}> = [
  { value: "today", label: "Azi" },
  { value: "7d", label: "7 zile" },
  { value: "30d", label: "30 zile" },
  { value: "month", label: "Luna aceasta" },
];

export function parseReportsRange(
  value: string | null | undefined,
): ReportsRangePreset {
  if (value === "today" || value === "7d" || value === "30d" || value === "month") {
    return value;
  }
  return "30d";
}

function startOfMonthDateString(today: string): string {
  const [y, m] = today.split("-");
  return `${y}-${m}-01`;
}

export function resolveReportsDateRange(preset: ReportsRangePreset): {
  from: string;
  to: string;
  label: string;
} {
  const to = getTodayInBookingTimezone();
  const label =
    REPORTS_RANGE_PRESETS.find((p) => p.value === preset)?.label ?? "30 zile";

  if (preset === "today") {
    return { from: to, to, label };
  }
  if (preset === "7d") {
    return { from: addDaysToDateString(to, -6), to, label };
  }
  if (preset === "month") {
    return { from: startOfMonthDateString(to), to, label };
  }
  // 30d
  return { from: addDaysToDateString(to, -29), to, label };
}

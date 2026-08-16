export type WeeklyScheduleRow = {
  day_of_week?: number;
  is_working: boolean;
  work_start: string | null;
  work_end: string | null;
  break_enabled: boolean;
  break_start: string | null;
  break_end: string | null;
};

export type DayOverrideRow = {
  date?: string;
  is_closed: boolean;
  work_start?: string | null;
  work_end?: string | null;
  break_enabled?: boolean;
  break_start?: string | null;
  break_end?: string | null;
  slot_duration?: number | null;
};

export type ScheduleMode = "weekly" | "selective";

export type ResolvedDaySchedule = {
  isWorking: boolean;
  workStart: string | null;
  workEnd: string | null;
  breakEnabled: boolean;
  breakStart: string | null;
  breakEnd: string | null;
  slotDuration: number | null;
};

function normTime(t: string | null | undefined): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

export function normalizeScheduleMode(
  value: string | null | undefined,
): ScheduleMode {
  return value === "selective" ? "selective" : "weekly";
}

/**
 * Resolve whether a barber works on a calendar day.
 *
 * - weekly (default): weekly template + day overrides
 * - selective: only day overrides with custom hours open the day;
 *   the weekly template never opens slots
 */
export function resolveDaySchedule(
  weekly: WeeklyScheduleRow | null | undefined,
  override: DayOverrideRow | null | undefined,
  scheduleMode: ScheduleMode = "weekly",
): ResolvedDaySchedule {
  const closed: ResolvedDaySchedule = {
    isWorking: false,
    workStart: null,
    workEnd: null,
    breakEnabled: false,
    breakStart: null,
    breakEnd: null,
    slotDuration: null,
  };

  if (override?.is_closed) return closed;

  const customStart = normTime(override?.work_start);
  const customEnd = normTime(override?.work_end);

  if (customStart && customEnd) {
    const breakEnabled = !!override?.break_enabled;

    return {
      isWorking: true,
      workStart: customStart,
      workEnd: customEnd,
      breakEnabled,
      breakStart: breakEnabled ? normTime(override?.break_start) : null,
      breakEnd: breakEnabled ? normTime(override?.break_end) : null,
      slotDuration: override?.slot_duration ?? null,
    };
  }

  if (scheduleMode === "selective") {
    return closed;
  }

  if (!weekly?.is_working) return closed;

  const breakEnabled = override?.break_enabled ?? weekly.break_enabled;
  const useOverrideBreak =
    override?.break_enabled !== undefined && override?.break_enabled !== null;

  return {
    isWorking: true,
    workStart: normTime(weekly.work_start),
    workEnd: normTime(weekly.work_end),
    breakEnabled: !!breakEnabled,
    breakStart: breakEnabled
      ? normTime(useOverrideBreak ? override?.break_start : weekly.break_start)
      : null,
    breakEnd: breakEnabled
      ? normTime(useOverrideBreak ? override?.break_end : weekly.break_end)
      : null,
    slotDuration: override?.slot_duration ?? null,
  };
}

export function hasCustomOverrideHours(
  override: DayOverrideRow | null | undefined,
): boolean {
  return !!(override?.work_start && override?.work_end && !override?.is_closed);
}

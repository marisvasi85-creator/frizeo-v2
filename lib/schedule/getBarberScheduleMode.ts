import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeScheduleMode,
  type ScheduleMode,
} from "@/lib/schedule/resolveDaySchedule";

export async function getBarberScheduleMode(
  barberId: string,
): Promise<ScheduleMode> {
  const { data } = await supabaseAdmin
    .from("barbers")
    .select("schedule_mode")
    .eq("id", barberId)
    .maybeSingle();

  return normalizeScheduleMode(
    (data as { schedule_mode?: string | null } | null)?.schedule_mode,
  );
}

export async function getBarberScheduleModes(
  barberIds: string[],
): Promise<Map<string, ScheduleMode>> {
  const map = new Map<string, ScheduleMode>();
  if (barberIds.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("barbers")
    .select("id, schedule_mode")
    .in("id", barberIds);

  for (const row of data ?? []) {
    map.set(
      row.id,
      normalizeScheduleMode(
        (row as { schedule_mode?: string | null }).schedule_mode,
      ),
    );
  }

  for (const id of barberIds) {
    if (!map.has(id)) map.set(id, "weekly");
  }

  return map;
}

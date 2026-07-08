import type { SupabaseClient } from "@supabase/supabase-js";

let cachedSupportsVacationPeriodId: boolean | null = null;

function isMissingVacationPeriodColumn(message?: string) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("vacation_period_id") ||
    lower.includes("schema cache") ||
    lower.includes("column")
  );
}

export async function barberOverridesSupportVacationPeriodId(
  supabase: SupabaseClient,
): Promise<boolean> {
  if (cachedSupportsVacationPeriodId !== null) {
    return cachedSupportsVacationPeriodId;
  }

  const { error } = await supabase
    .from("barber_day_overrides")
    .select("vacation_period_id")
    .limit(1);

  if (error && isMissingVacationPeriodColumn(error.message)) {
    cachedSupportsVacationPeriodId = false;
    return false;
  }

  cachedSupportsVacationPeriodId = true;
  return true;
}

export function isMissingVacationPeriodColumnError(message?: string) {
  return isMissingVacationPeriodColumn(message);
}

export function vacationPeriodIdFromRange(from: string, to: string) {
  return `range:${from}:${to}`;
}

export function parseRangeVacationPeriodId(id: string) {
  if (!id.startsWith("range:")) return null;
  const [, from, to] = id.split(":");
  if (!from || !to) return null;
  return { from, to };
}

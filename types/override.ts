export type Override = {
  id?: string;
  barber_id?: string;
  date: string;
  is_closed: boolean;
  work_start: string | null;
  work_end: string | null;
  break_enabled: boolean;
  break_start: string | null;
  break_end: string | null;
  slot_duration?: number | null;
};

export type OverrideMode = "closed" | "custom";

export type TimeString = string; // "HH:mm"

export type WeeklySchedule = {
  is_working: boolean;
  work_start: TimeString | null;
  work_end: TimeString | null;
  break_enabled: boolean;
  break_start: TimeString | null;
  break_end: TimeString | null;
};

export type DayOverride = {
  is_closed: boolean;
  work_start?: TimeString | null;
  work_end?: TimeString | null;
  break_enabled?: boolean | null;
  break_start?: TimeString | null;
  break_end?: TimeString | null;
  slot_duration?: number | null;
};

export type BarberSettings = {
  slot_duration: number; // minute
};

export type Booking = {
  id: string;

  barber_id: string;
  date: string;

  start_time: string;
  end_time: string;

  status: string;

  reschedule_token?: string | null;
  rescheduled_from?: string | null;
};


export type DateInterval = {
  start: Date;
  end: Date;
};

export type Slot = {
  start: string;
  end: string;
};


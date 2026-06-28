import {
  compareAsc,
  endOfWeek,
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ro } from "date-fns/locale";

export type GroupMode = "day" | "week" | "month";

export type BookingRow = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string;
  barber_id?: string;
  client_name: string;
  client_phone?: string;
  status?: string;
  barber?: { display_name?: string } | null;
  barber_services?: {
    display_name?: string;
    name?: string;
    duration?: number;
  } | null;
};

export type BookingGroup = {
  key: string;
  label: string;
  count: number;
  bookings: BookingRow[];
  sortKey: string;
  highlight?: boolean;
};

export type BookingsTimeline = {
  upcoming: BookingGroup[];
  past: BookingGroup[];
};

function bookingDateTime(booking: BookingRow): Date {
  const [hours, minutes] = booking.start_time.slice(0, 5).split(":").map(Number);
  const date = parseISO(`${booking.date}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function dayLabel(date: Date): { label: string; highlight: boolean } {
  if (isToday(date)) {
    return { label: "Azi", highlight: true };
  }

  if (isTomorrow(date)) {
    return { label: "Mâine", highlight: true };
  }

  if (isYesterday(date)) {
    return { label: "Ieri", highlight: false };
  }

  return {
    label: format(date, "EEEE, d MMMM yyyy", { locale: ro }),
    highlight: false,
  };
}

function weekLabel(date: Date): string {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });

  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth && sameYear) {
    return `${format(start, "d", { locale: ro })}–${format(end, "d MMMM yyyy", { locale: ro })}`;
  }

  if (sameYear) {
    return `${format(start, "d MMM", { locale: ro })} – ${format(end, "d MMM yyyy", { locale: ro })}`;
  }

  return `${format(start, "d MMM yyyy", { locale: ro })} – ${format(end, "d MMM yyyy", { locale: ro })}`;
}

function monthLabel(date: Date): string {
  return format(date, "MMMM yyyy", { locale: ro });
}

function groupKey(booking: BookingRow, mode: GroupMode): string {
  const date = parseISO(`${booking.date}T00:00:00`);

  if (mode === "day") {
    return booking.date;
  }

  if (mode === "week") {
    return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
  }

  return format(startOfMonth(date), "yyyy-MM");
}

function groupLabel(key: string, mode: GroupMode, sampleDate: Date): {
  label: string;
  highlight?: boolean;
} {
  if (mode === "day") {
    const { label, highlight } = dayLabel(sampleDate);
    return { label, highlight };
  }

  if (mode === "week") {
    return { label: `Săpt. ${weekLabel(sampleDate)}` };
  }

  return { label: monthLabel(sampleDate) };
}

function sortBookings(bookings: BookingRow[], direction: "asc" | "desc") {
  return [...bookings].sort((a, b) => {
    const cmp = compareAsc(bookingDateTime(a), bookingDateTime(b));
    return direction === "asc" ? cmp : -cmp;
  });
}

function buildGroups(
  bookings: BookingRow[],
  mode: GroupMode,
  direction: "asc" | "desc"
): BookingGroup[] {
  const map = new Map<string, BookingRow[]>();

  for (const booking of bookings) {
    const key = groupKey(booking, mode);
    const list = map.get(key) ?? [];
    list.push(booking);
    map.set(key, list);
  }

  const groups: BookingGroup[] = [];

  for (const [key, items] of map.entries()) {
    const sortedItems = sortBookings(items, "asc");
    const sampleDate = parseISO(`${sortedItems[0].date}T00:00:00`);
    const { label, highlight } = groupLabel(key, mode, sampleDate);

    groups.push({
      key,
      label,
      count: sortedItems.length,
      bookings: sortedItems,
      sortKey: key,
      highlight,
    });
  }

  return groups.sort((a, b) => {
    const cmp = a.sortKey.localeCompare(b.sortKey);
    return direction === "asc" ? cmp : -cmp;
  });
}

export function groupBookingsForList(
  bookings: BookingRow[],
  mode: GroupMode
): BookingsTimeline {
  const now = new Date();

  const upcoming: BookingRow[] = [];
  const past: BookingRow[] = [];

  for (const booking of bookings) {
    if (bookingDateTime(booking) >= now) {
      upcoming.push(booking);
    } else {
      past.push(booking);
    }
  }

  return {
    upcoming: buildGroups(upcoming, mode, "asc"),
    past: buildGroups(past, mode, "desc"),
  };
}

export function countBookings(groups: BookingGroup[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}

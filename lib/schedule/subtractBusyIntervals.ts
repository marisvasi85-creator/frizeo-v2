export type TimeInterval = {
  start: string;
  end: string;
};

function norm(time: string): string {
  return String(time).slice(0, 5);
}

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Punch released Frizeo intervals out of Google FreeBusy.
 * Leftover calendar events from cancelled bookings otherwise keep the
 * public slot occupied after the row is already cancelled in Postgres.
 */
export function subtractBusyIntervals<T extends TimeInterval>(
  busy: T[],
  removals: TimeInterval[],
): TimeInterval[] {
  let result: TimeInterval[] = busy.map((interval) => ({
    start: norm(interval.start),
    end: norm(interval.end),
  }));

  for (const removal of removals) {
    const rStart = timeToMinutes(norm(removal.start));
    const rEnd = timeToMinutes(norm(removal.end));
    if (!(rEnd > rStart)) continue;

    const next: TimeInterval[] = [];
    for (const interval of result) {
      const iStart = timeToMinutes(interval.start);
      const iEnd = timeToMinutes(interval.end);
      if (!(iEnd > iStart) || rEnd <= iStart || rStart >= iEnd) {
        if (iEnd > iStart) next.push(interval);
        continue;
      }
      if (iStart < rStart) {
        next.push({
          start: minutesToTime(iStart),
          end: minutesToTime(rStart),
        });
      }
      if (iEnd > rEnd) {
        next.push({
          start: minutesToTime(rEnd),
          end: minutesToTime(iEnd),
        });
      }
    }
    result = next;
  }

  return result;
}

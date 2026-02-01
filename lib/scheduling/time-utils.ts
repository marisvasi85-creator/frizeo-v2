export function toDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function formatTime(date: Date): string {
  if (isNaN(date.getTime())) {
    throw new Error("Invalid Date passed to formatTime");
  }
  return date.toISOString().slice(11, 16);
}


export function endOfDay(date: string): Date {
  return new Date(`${date}T23:59:59`);
}

export function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

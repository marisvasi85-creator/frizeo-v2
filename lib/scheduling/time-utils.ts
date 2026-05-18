export function getDayOfWeek(date: string) {
  const d = new Date(date);
  const jsDay = d.getDay(); // 0-6 (Sun-Sat)

  return jsDay === 0 ? 7 : jsDay; // 1-7 (Mon-Sun)
}

export function toISO(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}
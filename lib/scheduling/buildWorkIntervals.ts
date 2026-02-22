export type DateInterval = {
  start: Date;
  end: Date;
};

function buildLocalDate(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);

  return new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second || 0,
    0
  );
}

/**
 * Construiește intervalele de lucru pentru o zi.
 * Fără probleme de timezone.
 */
export function buildWorkIntervals(
  date: string,
  workStart: string,
  workEnd: string
): DateInterval[] {
  console.log("🧱 buildWorkIntervals()", {
    date,
    workStart,
    workEnd,
  });

  const start = buildLocalDate(date, workStart);
  const end = buildLocalDate(date, workEnd);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.log("⛔ Invalid date/time in buildWorkIntervals");
    return [];
  }

  // Caz normal
  if (end > start) {
    return [{ start, end }];
  }

  // Caz peste miezul nopții
  const endOfDay = buildLocalDate(date, "23:59:59");

  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);

  const nextDateStr = `${nextDay.getFullYear()}-${String(
    nextDay.getMonth() + 1
  ).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;

  const startNextDay = buildLocalDate(nextDateStr, "00:00:00");
  const endNextDay = buildLocalDate(nextDateStr, workEnd);

  return [
    { start, end: endOfDay },
    { start: startNextDay, end: endNextDay },
  ];
}

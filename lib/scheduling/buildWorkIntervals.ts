export type DateInterval = {
  start: Date;
  end: Date;
};

/**
 * Construiește intervalele de lucru pentru o zi.
 * Suportă și cazurile când programul trece peste miezul nopții.
 */
export function buildWorkIntervals(
  date: string,          // "2026-01-30"
  workStart: string,     // "09:00:00"
  workEnd: string        // "17:00:00"
): DateInterval[] {
  console.log("🧱 buildWorkIntervals()", {
    date,
    workStart,
    workEnd,
  });

  const start = new Date(`${date}T${workStart}`);
  const end = new Date(`${date}T${workEnd}`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.log("⛔ Invalid date/time in buildWorkIntervals");
    return [];
  }

  // 👉 Caz normal: 09:00 → 17:00
  if (end > start) {
    return [{ start, end }];
  }

  // 👉 Caz rar: program peste miezul nopții (ex: 22:00 → 02:00)
  const endOfDay = new Date(`${date}T23:59:59`);
  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);

  const startNextDay = new Date(
    nextDay.toISOString().slice(0, 10) + `T00:00:00`
  );

  const endNextDay = new Date(
    nextDay.toISOString().slice(0, 10) + `T${workEnd}`
  );

  return [
    { start, end: endOfDay },
    { start: startNextDay, end: endNextDay },
  ];
}

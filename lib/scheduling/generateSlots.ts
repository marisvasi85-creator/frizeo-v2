export function generateSlots({
  start,
  end,
  step,
}: {
  start: string; // "09:00"
  end: string;   // "18:00"
  step: number;  // 15
}) {
  const slots: string[] = [];

  let [h, m] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  while (h < endH || (h === endH && m < endM)) {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");

    slots.push(`${hh}:${mm}`);

    m += step;

    if (m >= 60) {
      h += Math.floor(m / 60);
      m = m % 60;
    }
  }

  return slots;
}
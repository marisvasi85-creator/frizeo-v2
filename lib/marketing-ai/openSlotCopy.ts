import type { OpenSlotDayFact } from "./types";

/** Exact appointment counts stay useful only while the day is still sparse. */
export const OPEN_SLOT_EXACT_COUNT_MAX = 4;

const MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

export function openSlotCountIsBookable(
  fact: OpenSlotDayFact,
): fact is OpenSlotDayFact & { freeCount: number; durationMinutes: number } {
  return (
    typeof fact.durationMinutes === "number" &&
    fact.durationMinutes > 0 &&
    typeof fact.freeCount === "number"
  );
}

export function openSlotCountIsWorthQuoting(
  fact: OpenSlotDayFact,
): fact is OpenSlotDayFact & { freeCount: number; durationMinutes: number } {
  return openSlotCountIsBookable(fact) && fact.freeCount <= OPEN_SLOT_EXACT_COUNT_MAX;
}

function appointmentNoun(count: number): string {
  return count === 1 ? "loc" : "locuri";
}

export function formatOpenSlotDayHeading(fact: OpenSlotDayFact): string {
  const [, monthText, dayText] = fact.date.split("-");
  const month = MONTHS[Number(monthText) - 1] || "";
  const weekday = fact.weekday
    ? fact.weekday.charAt(0).toUpperCase() + fact.weekday.slice(1)
    : fact.date;
  const label = `${weekday}, ${Number(dayText)} ${month}`.trim();
  if (!openSlotCountIsBookable(fact)) return label;
  return `${label} — ${fact.freeCount} ${appointmentNoun(fact.freeCount)}`;
}

export function formatOpenSlotFacts(facts: OpenSlotDayFact[]): string {
  if (!facts.length) return "Niciun loc liber în următoarele 7 zile.";
  return facts
    .map((fact) => {
      if (openSlotCountIsWorthQuoting(fact)) {
        const examples = fact.sampleTimes.length
          ? ` (exemple de ore: ${fact.sampleTimes.join(", ")})`
          : "";
        return `${fact.weekday} ${fact.date}: ${fact.freeCount} ${appointmentNoun(fact.freeCount)}${examples}`;
      }
      return `${fact.weekday} ${fact.date}: mai sunt locuri disponibile. Nu menționa un număr de locuri.`;
    })
    .join("\n");
}

export function openSlotTemplateLine(facts: OpenSlotDayFact[]): string {
  return facts
    .map((fact) => {
      if (!openSlotCountIsWorthQuoting(fact)) return fact.weekday;
      return `${fact.weekday} (${fact.freeCount} ${appointmentNoun(fact.freeCount)})`;
    })
    .join(", ");
}

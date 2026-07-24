import type { LocationFields } from "@/lib/location/types";
import { formatLocationAddress } from "@/lib/location/resolveLocation";

const SCHEMA_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export type WeeklyScheduleRow = {
  day_of_week: number;
  is_working?: boolean | null;
  work_start?: string | null;
  work_end?: string | null;
};

export type SalonSeoSource = LocationFields & {
  name?: string | null;
  slug?: string | null;
  phone?: string | null;
  description?: string | null;
  logo_url?: string | null;
  address?: string | null;
};

function normTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 5);
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Aggregate salon hours from active barbers' weekly schedules (earliest open → latest close). */
export function buildOpeningHoursSpecification(
  rows: WeeklyScheduleRow[]
): Array<{
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string;
  opens: string;
  closes: string;
}> {
  const byDay = new Map<number, { opens: number; closes: number }>();

  for (const row of rows) {
    if (!row.is_working) continue;
    const opens = normTime(row.work_start);
    const closes = normTime(row.work_end);
    if (!opens || !closes) continue;

    const day = Number(row.day_of_week);
    if (!Number.isFinite(day) || day < 1 || day > 7) continue;

    const openMin = timeToMinutes(opens);
    const closeMin = timeToMinutes(closes);
    if (closeMin <= openMin) continue;

    const existing = byDay.get(day);
    if (!existing) {
      byDay.set(day, { opens: openMin, closes: closeMin });
    } else {
      byDay.set(day, {
        opens: Math.min(existing.opens, openMin),
        closes: Math.max(existing.closes, closeMin),
      });
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, hours]) => ({
      "@type": "OpeningHoursSpecification" as const,
      dayOfWeek: `https://schema.org/${[
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ][day - 1]}`,
      opens: minutesToTime(hours.opens),
      closes: minutesToTime(hours.closes),
    }));
}

/** Compact openingHours strings e.g. "Mo 09:00-18:00". */
export function buildOpeningHours(rows: WeeklyScheduleRow[]): string[] {
  return buildOpeningHoursSpecification(rows).map((spec) => {
    const idx = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ].findIndex((d) => spec.dayOfWeek.endsWith(d));
    const code = SCHEMA_DAYS[idx] || "Mo";
    return `${code} ${spec.opens}-${spec.closes}`;
  });
}

export function buildPriceRange(
  prices: Array<number | null | undefined>
): string | null {
  const nums = prices.filter(
    (p): p is number => typeof p === "number" && Number.isFinite(p) && p >= 0
  );
  if (nums.length === 0) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return `${Math.round(min)} RON`;
  return `${Math.round(min)}-${Math.round(max)} RON`;
}

export function salonCity(salon: SalonSeoSource): string | null {
  const city = salon.location_city?.trim();
  return city || null;
}

export function buildSalonSeoTitle(salon: SalonSeoSource): string {
  const name = String(salon.name || "Salon").trim();
  const city = salonCity(salon);
  if (city) {
    return `${name} — Frizerie în ${city} | Programări online`;
  }
  return `${name} — Programări online`;
}

export function buildSalonSeoDescription(salon: SalonSeoSource): string {
  const name = String(salon.name || "salon").trim();
  const city = salonCity(salon);
  const custom =
    typeof salon.description === "string" ? salon.description.trim() : "";

  if (custom) {
    return custom.slice(0, 160);
  }

  if (city) {
    return `Programează-te online la ${name} din ${city}. Alege frizerul, serviciul și ora — confirmare rapidă, fără telefon.`;
  }

  return `Programează-te online la ${name}. Alege frizerul, serviciul și ora disponibilă.`;
}

export function buildSalonSeoKeywords(salon: SalonSeoSource): string[] {
  const name = String(salon.name || "").trim();
  const city = salonCity(salon);
  const keywords = [
    name,
    "programări online frizerie",
    "frizerie",
    "barbershop",
    "programare frizer",
  ].filter(Boolean);

  if (city) {
    keywords.push(
      `frizerie ${city}`,
      `barbershop ${city}`,
      `frizer ${city}`,
      `programări frizerie ${city}`
    );
  }

  return keywords;
}

export function buildBarberSeoTitle(
  barberName: string,
  salon: SalonSeoSource
): string {
  const city = salonCity(salon);
  if (city) {
    return `${barberName} — ${salon.name} | Programare online ${city}`;
  }
  return `Programare online — ${barberName} | ${salon.name}`;
}

export function buildBarberSeoDescription(
  barberName: string,
  salon: SalonSeoSource
): string {
  const city = salonCity(salon);
  if (city) {
    return `Programează-te la ${barberName} (${salon.name}) în ${city}. Alege serviciul, data și ora disponibilă online.`;
  }
  return `Programează-te la ${barberName}, ${salon.name}. Alege serviciul, data și ora disponibilă.`;
}

export function postalAddressFromSalon(salon: SalonSeoSource) {
  const line =
    salon.location_address_line?.trim() ||
    salon.address?.trim() ||
    null;
  const city = salon.location_city?.trim() || null;
  const county = salon.location_county?.trim() || null;
  const postal = salon.location_postal_code?.trim() || null;
  const formatted = formatLocationAddress(salon);

  if (!line && !city && !formatted) return null;

  return {
    "@type": "PostalAddress" as const,
    ...(line ? { streetAddress: line } : {}),
    ...(city ? { addressLocality: city } : {}),
    ...(county ? { addressRegion: county } : {}),
    ...(postal ? { postalCode: postal } : {}),
    addressCountry: "RO",
  };
}

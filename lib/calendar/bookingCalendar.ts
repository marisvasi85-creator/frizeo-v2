import { BOOKING_TIMEZONE, zonedDateTimeToUtcMs } from "@/lib/bookings/bookingTimezone";
import { getAppUrl } from "@/lib/app/getAppUrl";

export type BookingCalendarEvent = {
  /** Booking id — used as stable ICS UID */
  bookingId: string;
  title: string;
  description?: string;
  location?: string | null;
  /** YYYY-MM-DD */
  date: string;
  startTime: string;
  endTime: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC timestamp for ICS / Google Calendar: `20260724T070000Z` */
export function formatCalendarUtc(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return chunks.join("\r\n");
}

export function buildBookingIcs(event: BookingCalendarEvent): string {
  const startMs = zonedDateTimeToUtcMs(event.date, event.startTime);
  const endMs = zonedDateTimeToUtcMs(event.date, event.endTime);
  const nowMs = Date.now();
  const uid = `${event.bookingId}@frizeo.ro`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Frizeo//Programari//RO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatCalendarUtc(nowMs)}`,
    `DTSTART:${formatCalendarUtc(startMs)}`,
    `DTEND:${formatCalendarUtc(endMs)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description.trim())}`);
  }

  if (event.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(event.location.trim())}`);
  }

  lines.push(
    `URL:${getAppUrl().replace(/\/$/, "")}/booking/confirmed/${event.bookingId}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function googleCalendarUrl(event: BookingCalendarEvent): string {
  const startMs = zonedDateTimeToUtcMs(event.date, event.startTime);
  const endMs = zonedDateTimeToUtcMs(event.date, event.endTime);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatCalendarUtc(startMs)}/${formatCalendarUtc(endMs)}`,
  });

  if (event.description?.trim()) {
    params.set("details", event.description.trim());
  }
  if (event.location?.trim()) {
    params.set("location", event.location.trim());
  }
  // Hint for Google; dates are already absolute UTC.
  params.set("ctz", BOOKING_TIMEZONE);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: BookingCalendarEvent): string {
  const startMs = zonedDateTimeToUtcMs(event.date, event.startTime);
  const endMs = zonedDateTimeToUtcMs(event.date, event.endTime);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: new Date(startMs).toISOString(),
    enddt: new Date(endMs).toISOString(),
  });

  if (event.description?.trim()) {
    params.set("body", event.description.trim());
  }
  if (event.location?.trim()) {
    params.set("location", event.location.trim());
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function bookingCalendarIcsUrl(cancelToken: string): string {
  const base = getAppUrl().replace(/\/$/, "");
  return `${base}/api/bookings/calendar?token=${encodeURIComponent(cancelToken)}`;
}

export function buildClientBookingCalendarEvent(input: {
  bookingId: string;
  serviceName: string;
  barberName: string;
  date: string;
  startTime: string;
  endTime: string;
  locationAddress?: string | null;
  notes?: string | null;
  cancelUrl?: string;
  rescheduleUrl?: string;
}): BookingCalendarEvent {
  const descriptionParts = [
    `Frizer: ${input.barberName}`,
    `Serviciu: ${input.serviceName}`,
  ];

  if (input.notes?.trim()) {
    descriptionParts.push(`Mențiuni: ${input.notes.trim()}`);
  }
  if (input.rescheduleUrl) {
    descriptionParts.push(`Reprogramare: ${input.rescheduleUrl}`);
  }
  if (input.cancelUrl) {
    descriptionParts.push(`Anulare: ${input.cancelUrl}`);
  }

  return {
    bookingId: input.bookingId,
    title: `${input.serviceName} — ${input.barberName}`,
    description: descriptionParts.join("\n"),
    location: input.locationAddress ?? null,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
  };
}

export function calendarEmailButtonsHtml(opts: {
  googleUrl: string;
  icsUrl: string;
}): string {
  return `
      <div style="margin:20px 0;">
        <p style="margin:0 0 10px 0;"><strong>Salvează în calendar</strong></p>
        <a href="${opts.googleUrl}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block; padding:10px 15px; background:#1a73e8; color:#fff; text-decoration:none; border-radius:6px; margin-right:10px; margin-bottom:8px;">
          Adaugă în Google Calendar
        </a>
        <a href="${opts.icsUrl}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block; padding:10px 15px; background:#111; color:#fff; text-decoration:none; border-radius:6px; margin-bottom:8px;">
          Descarcă pentru Apple / Outlook
        </a>
        <p style="font-size:12px; color:#777; margin:8px 0 0 0;">
          Am atașat și fișierul .ics la acest email — pe telefon, deschide-l ca să salvezi programarea.
        </p>
      </div>
  `;
}

import type { GoogleCalendarEvent } from "@/lib/google/calendarBusy";

const MAX_CALENDARS = 8;
const MAX_EVENT_PAGES = 3;

type CalendarListItem = {
  id?: string | null;
  selected?: boolean | null;
  primary?: boolean | null;
};

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listWritableCalendarIds(
  accessToken: string,
  fallbackId: string,
): Promise<string[]> {
  try {
    const url =
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer&maxResults=50";
    const res = await fetch(url, {
      headers: authHeaders(accessToken),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      console.error("GOOGLE CALENDAR LIST ERROR:", res.status);
      return [fallbackId];
    }

    const data = (await res.json()) as { items?: CalendarListItem[] | null };
    const ids: string[] = [];

    for (const item of data.items ?? []) {
      if (!item?.id) continue;
      if (item.primary === true || item.selected !== false) {
        ids.push(item.id);
      }
    }

    if (fallbackId !== "primary" && !ids.includes(fallbackId)) {
      ids.unshift(fallbackId);
    }

    if (ids.length === 0) {
      return [fallbackId];
    }

    return [...new Set(ids)].slice(0, MAX_CALENDARS);
  } catch (err) {
    console.error("GOOGLE CALENDAR LIST ERROR:", err);
    return [fallbackId];
  }
}

async function listEventsForCalendar({
  accessToken,
  calendarId,
  timeMin,
  timeMax,
}: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}): Promise<GoogleCalendarEvent[] | null> {
  try {
    const events: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < MAX_EVENT_PAGES; page++) {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId,
        )}/events`,
      );
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("showDeleted", "false");
      url.searchParams.set("maxResults", "250");
      url.searchParams.set("orderBy", "startTime");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: authHeaders(accessToken),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error(
          "GOOGLE EVENTS LIST ERROR:",
          calendarId,
          JSON.stringify(data, null, 2),
        );
        return null;
      }

      const data = (await res.json()) as {
        items?: GoogleCalendarEvent[] | null;
        nextPageToken?: string | null;
      };
      events.push(...(data.items ?? []));
      pageToken = data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    return events;
  } catch (err) {
    console.error("GOOGLE EVENTS LIST ERROR:", calendarId, err);
    return null;
  }
}

function dedupeEvents(events: GoogleCalendarEvent[]): GoogleCalendarEvent[] {
  const seen = new Set<string>();
  const unique: GoogleCalendarEvent[] = [];

  for (const event of events) {
    const key =
      event.id ||
      `${event.start?.dateTime || event.start?.date || ""}-${event.end?.dateTime || event.end?.date || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(event);
  }

  return unique;
}

/**
 * Read the barber's own writable calendars. Returns null only when every
 * events.list call failed, so callers can fall back to FreeBusy.
 */
export async function listBusyCalendarEvents({
  accessToken,
  calendarId,
  timeMin,
  timeMax,
}: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}): Promise<GoogleCalendarEvent[] | null> {
  const calendarIds = await listWritableCalendarIds(accessToken, calendarId);
  const results = await Promise.all(
    calendarIds.map((id) =>
      listEventsForCalendar({
        accessToken,
        calendarId: id,
        timeMin,
        timeMax,
      }),
    ),
  );

  const succeeded = results.filter(
    (events): events is GoogleCalendarEvent[] => events !== null,
  );
  if (succeeded.length === 0) {
    return null;
  }

  return dedupeEvents(succeeded.flat());
}

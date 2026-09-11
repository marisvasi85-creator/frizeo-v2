const GONE_STATUSES = new Set([404, 410]);

export function googleEventAlreadyGone(status: number): boolean {
  return GONE_STATUSES.has(status);
}

export function googleEventReleased(status: number): boolean {
  return (status >= 200 && status < 300) || googleEventAlreadyGone(status);
}

function eventUrl(calendarId: string, eventId: string): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId,
  )}/events/${encodeURIComponent(eventId)}`;
}

export async function deleteGoogleEvent({
  accessToken,
  calendarId,
  eventId,
}: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<boolean> {
  const res = await fetch(eventUrl(calendarId, eventId), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return googleEventReleased(res.status);
}

/**
 * Remove a Frizeo booking from Google FreeBusy. DELETE is preferred;
 * if that fails the event is patched to transparent/cancelled so the
 * public slot is released even when delete is denied.
 */
export async function releaseGoogleCalendarEvent({
  accessToken,
  calendarId,
  eventId,
}: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<boolean> {
  if (await deleteGoogleEvent({ accessToken, calendarId, eventId })) {
    return true;
  }

  const res = await fetch(eventUrl(calendarId, eventId), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transparency: "transparent",
      status: "cancelled",
    }),
  });

  return googleEventReleased(res.status);
}

export type GoogleBusyBlock = {
  start: string;
  end: string;
};

type FreeBusyCalendar = {
  busy?: GoogleBusyBlock[] | null;
};

export function busyIntervalsFromFreeBusyResponse(
  data: { calendars?: Record<string, FreeBusyCalendar> | null } | null | undefined,
  calendarId: string,
): GoogleBusyBlock[] {
  const calendars = data?.calendars ?? {};
  const requested = calendars[calendarId];
  if (Array.isArray(requested?.busy)) return requested.busy;

  // Google sometimes keys the response by the real calendar email even
  // when the request used "primary".
  for (const entry of Object.values(calendars)) {
    if (Array.isArray(entry?.busy)) return entry.busy;
  }

  return [];
}

export async function queryFreeBusy({
  accessToken,
  calendarId,
  timeMin,
  timeMax,
}: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}): Promise<GoogleBusyBlock[]> {
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: calendarId }],
      }),
      signal: AbortSignal.timeout(4000),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("GOOGLE FREEBUSY ERROR:", JSON.stringify(data, null, 2));
      return [];
    }

    return busyIntervalsFromFreeBusyResponse(data, calendarId);
  } catch (err) {
    console.error("GOOGLE FREEBUSY ERROR:", err);
    return [];
  }
}

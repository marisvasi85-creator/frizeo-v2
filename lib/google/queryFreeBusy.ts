export type GoogleBusyBlock = {
  start: string;
  end: string;
};

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
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("GOOGLE FREEBUSY ERROR:", JSON.stringify(data, null, 2));
    return [];
  }

  return data.calendars?.[calendarId]?.busy ?? [];
}

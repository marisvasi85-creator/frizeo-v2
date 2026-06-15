// lib/google/createEvent.ts

export async function createGoogleEvent({
  accessToken,
  calendarId,
  title,
  description,
  start,
  end,
}: {
  accessToken: string;
  calendarId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
}) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        description,

        start: {
          dateTime: start,
          timeZone: "Europe/Bucharest",
        },

        end: {
          dateTime: end,
          timeZone: "Europe/Bucharest",
        },
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error(
      "GOOGLE EVENT ERROR:",
      JSON.stringify(data, null, 2)
    );

    return null;
  }

  return data;
}
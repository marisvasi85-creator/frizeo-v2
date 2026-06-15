export async function createGoogleEvent({
  accessToken,
  calendarId,
  title,
  start,
  end,
}: {
  accessToken: string;
  calendarId: string;
  title: string;
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
    console.error("GOOGLE EVENT ERROR:", data);
    return null;
  }

  return data;
}
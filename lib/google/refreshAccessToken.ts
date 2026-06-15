export async function refreshAccessToken(
  refreshToken: string
) {
  const res = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id:
          process.env.GOOGLE_CLIENT_ID!,
        client_secret:
          process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error(
      "GOOGLE REFRESH ERROR:",
      data
    );

    return null;
  }

  return data;
}
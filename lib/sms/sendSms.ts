export type SendSmsResult =
  | { ok: true; data: unknown }
  | { ok: false; data: unknown | null };

export async function sendSms({
  phone,
  message,
}: {
  phone: string;
  message: string;
}): Promise<SendSmsResult> {
  try {
    if (!process.env.SMSO_API_KEY) {
      console.error("SMS ERROR: SMSO_API_KEY is not configured");
      return { ok: false, data: null };
    }

    const sender = 4;

    const formattedPhone = phone
      .replace(/\s/g, "")
      .replace(/^0/, "40");

    const url =
      `https://app.smso.ro/api/v1/send` +
      `?sender=${sender}` +
      `&to=${encodeURIComponent(formattedPhone)}` +
      `&body=${encodeURIComponent(message)}` +
      `&apiKey=${process.env.SMSO_API_KEY}`;

    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    const status =
      typeof data === "object" &&
      data !== null &&
      "status" in data &&
      typeof (data as { status: unknown }).status === "number"
        ? (data as { status: number }).status
        : null;

    const ok = res.ok && (status === null || status === 200);

    if (!ok) {
      console.error("SMS ERROR:", data);
    }

    return { ok, data };
  } catch (e) {
    console.error("SMS ERROR:", e);
    return { ok: false, data: null };
  }
}
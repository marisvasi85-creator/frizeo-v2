import { recordSmsSend, type SmsType } from "@/lib/sms/usage";

export type SendSmsResult =
  | { ok: true; data: unknown }
  | { ok: false; data: unknown | null };

export type SendSmsMeta = {
  tenantId: string;
  bookingId?: string | null;
  barberId?: string | null;
  smsType: SmsType;
};

export async function sendSms({
  phone,
  message,
  meta,
}: {
  phone: string;
  message: string;
  /** Required for usage tracking (Platform AI). */
  meta?: SendSmsMeta;
}): Promise<SendSmsResult> {
  const formattedPhone = phone.replace(/\s/g, "").replace(/^0/, "40");

  const logAttempt = async (
    ok: boolean,
    data: unknown | null,
    providerStatus: number | null = null,
  ) => {
    if (!meta?.tenantId) return;
    await recordSmsSend({
      tenantId: meta.tenantId,
      bookingId: meta.bookingId,
      barberId: meta.barberId,
      smsType: meta.smsType,
      phone: formattedPhone,
      ok,
      providerStatus,
      providerResponse: data,
    });
  };

  try {
    if (!process.env.SMSO_API_KEY) {
      console.error("SMS ERROR: SMSO_API_KEY is not configured");
      await logAttempt(false, { error: "SMSO_API_KEY missing" });
      return { ok: false, data: null };
    }

    const sender = "4";
    const body = new URLSearchParams({
      sender,
      to: formattedPhone,
      body: message,
    });

    // SMSO: prefer X-Authorization header — never put apiKey in the URL.
    const res = await fetch("https://app.smso.ro/api/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Authorization": process.env.SMSO_API_KEY,
      },
      body,
    });
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

    await logAttempt(ok, data, status);

    return { ok, data };
  } catch (e) {
    console.error("SMS ERROR:", e);
    await logAttempt(false, {
      error: e instanceof Error ? e.message : "unknown",
    });
    return { ok: false, data: null };
  }
}

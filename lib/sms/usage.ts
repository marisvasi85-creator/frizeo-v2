import { getTodayInBookingTimezone } from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SmsType =
  | "booking"
  | "reminder"
  | "reschedule"
  | "cancel"
  | "access_request";

export const SMS_TYPES: SmsType[] = [
  "booking",
  "reminder",
  "reschedule",
  "cancel",
  "access_request",
];

let smsSendsTableReady: boolean | null = null;

export async function hasSmsSendsTable(): Promise<boolean> {
  if (smsSendsTableReady !== null) return smsSendsTableReady;

  const { error } = await supabaseAdmin.from("sms_sends").select("id").limit(1);

  smsSendsTableReady = !error;
  return smsSendsTableReady;
}

export function smsSendsMigrationMessage(): string {
  return "Rulează migrarea supabase/migrations/20260725_sms_sends.sql în Supabase SQL Editor pentru a activa contorizarea SMS.";
}

function truncateProviderResponse(data: unknown): unknown {
  if (data == null) return null;
  try {
    const raw = JSON.stringify(data);
    if (raw.length <= 2000) return data;
    return { truncated: true, preview: raw.slice(0, 1800) };
  } catch {
    return null;
  }
}

export async function recordSmsSend(input: {
  tenantId: string;
  bookingId?: string | null;
  barberId?: string | null;
  smsType: SmsType;
  phone: string;
  ok: boolean;
  provider?: string;
  providerStatus?: number | null;
  providerResponse?: unknown;
}): Promise<void> {
  try {
    if (!(await hasSmsSendsTable())) return;

    await supabaseAdmin.from("sms_sends").insert({
      tenant_id: input.tenantId,
      booking_id: input.bookingId ?? null,
      barber_id: input.barberId ?? null,
      sms_type: input.smsType,
      phone: input.phone,
      ok: input.ok,
      provider: input.provider ?? "smso",
      provider_status: input.providerStatus ?? null,
      provider_response: truncateProviderResponse(input.providerResponse),
      usage_date: getTodayInBookingTimezone(),
    });
  } catch (e) {
    console.error("SMS USAGE LOG ERROR:", e);
  }
}

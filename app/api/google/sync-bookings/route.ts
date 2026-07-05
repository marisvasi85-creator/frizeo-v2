import { NextResponse } from "next/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { backfillBarberCalendarEvents } from "@/lib/google/syncBookingEvent";

export async function POST() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    return NextResponse.json({ error: "Nu ești autentificat." }, { status: 401 });
  }

  const { data: googleAccount } = await supabaseAdmin
    .from("barber_google_accounts")
    .select("refresh_token, access_token")
    .eq("barber_id", barber.id)
    .maybeSingle();

  if (!googleAccount?.refresh_token && !googleAccount?.access_token) {
    return NextResponse.json(
      { error: "Google Calendar nu este conectat." },
      { status: 400 },
    );
  }

  const result = await backfillBarberCalendarEvents(supabaseAdmin, barber.id);

  return NextResponse.json({
    success: true,
    synced: result.synced,
    failed: result.failed,
  });
}

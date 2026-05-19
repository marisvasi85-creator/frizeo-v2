import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export async function POST(req: Request) {
  try {
    const supabase = createSupabasePublicClient();
    const body = await req.json();

    const { barber_id, barber_service_id, date, start_time, end_time } = body;

    if (!barber_id || !barber_service_id || !date || !start_time || !end_time) {
      return NextResponse.json(
        { error: "Date invalide" },
        { status: 400 }
      );
    }

    // 🔥 GET TENANT
    const { data: barber } = await supabase
      .from("barbers")
      .select("tenant_id")
      .eq("id", barber_id)
      .single();

    if (!barber) {
      return NextResponse.json(
        { error: "Barber invalid" },
        { status: 400 }
      );
    }

    // 🔥 CHECK SLOT OCCUPAT (IMPORTANT)
    const { data: existing } = await supabase
  .from("bookings")
  .select("id, start_time, end_time")
  .eq("barber_id", barber_id)
  .eq("date", date)
  .in("status", ["pending", "confirmed"]);

const overlap = existing?.some((b: any) => {
  return start_time < b.end_time && end_time > b.start_time;
});

if (overlap) {
  return NextResponse.json(
    { error: "Slot ocupat" },
    { status: 400 }
  );
}

    // 🔥 HOLD 10 minute
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // 🔥 TOKENURI GENERATE AICI (CRITIC)
    const cancelToken = crypto.randomUUID();
    const rescheduleToken = crypto.randomUUID();

    const { data, error } = await supabase
  .from("bookings")
  .insert({
    barber_id,
    barber_service_id, // ✅ AICI ESTE FIXUL
    tenant_id: barber.tenant_id,
    date,
    start_time,
    end_time,
    status: "pending",
    expires_at: expiresAt.toISOString(),
    cancel_token: cancelToken,
    reschedule_token: rescheduleToken,
  })
  .select()
  .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Nu se poate crea hold" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      holdId: data.id,
      expiresAt: data.expires_at,
    });

  } catch (err) {
    console.error("HOLD ERROR:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
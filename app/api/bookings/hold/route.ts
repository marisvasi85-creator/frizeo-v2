import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export async function POST(req: Request) {
  const supabase = createSupabasePublicClient();
  const body = await req.json();

  const { barber_id, date, start_time, end_time } = body;

  if (!barber_id || !date || !start_time || !end_time) {
    return NextResponse.json(
      { error: "Date invalide" },
      { status: 400 }
    );
  }

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

  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("barber_id", barber_id)
    .eq("date", date)
    .eq("start_time", start_time)
    .in("status", ["pending", "confirmed"]);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "Slot ocupat" },
      { status: 400 }
    );
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      barber_id,
      tenant_id: barber.tenant_id,
      date,
      start_time,
      end_time,
      status: "pending",
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Nu se poate crea hold" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    holdId: data.id,
    expiresAt: data.expires_at,
  });
}
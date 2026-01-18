import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");

  if (!barberId || !date) {
    return NextResponse.json([], { status: 200 });
  }

  const { data, error } = await supabaseServer
    .from("bookings")
    .select("booking_time")
    .eq("barber_id", barberId)
    .eq("booking_date", date)
    .eq("status", "confirmed");

  if (error) {
    console.error("occupied error:", error);
    return NextResponse.json([], { status: 500 });
  }

  // ["09:00", "10:00"]
  return NextResponse.json(data.map(b => b.booking_time));
}

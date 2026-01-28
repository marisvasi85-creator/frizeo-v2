import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("barber_id", barberId)
    .order("booking_date");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

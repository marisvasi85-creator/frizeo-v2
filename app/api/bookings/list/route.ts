import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const date = searchParams.get("date");

    if (!barberId || !date) {
      return NextResponse.json(
        { error: "Parametri lipsă" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_date,
        booking_time,
        client_name,
        client_phone,
        client_email,
        status,
        cancel_token
      `)
      .eq("barber_id", barberId)
      .eq("booking_date", date)
      .order("booking_time", { ascending: true });

    if (error) {
      console.error("List bookings error:", error);
      return NextResponse.json(
        { error: "Eroare încărcare programări" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bookings: data ?? [],
    });
  } catch (err) {
    console.error("List bookings exception:", err);
    return NextResponse.json(
      { error: "Eroare server" },
      { status: 500 }
    );
  }
}

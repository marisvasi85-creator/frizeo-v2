import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { tenant_id, barber_id, date } = await req.json();

    if (!tenant_id || !barber_id || !date) {
      return NextResponse.json(
        { error: "tenant_id, barber_id și date sunt obligatorii" },
        { status: 400 }
      );
    }

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("booking_time")
      .eq("tenant_id", tenant_id)
      .eq("barber_id", barber_id)
      .eq("booking_date", date)
      .eq("status", "confirmed");

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Eroare la citirea programărilor" },
        { status: 500 }
      );
    }

    const occupied = bookings.map(b => b.booking_time);

    return NextResponse.json({ occupied });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Eroare server" },
      { status: 500 }
    );
  }
}

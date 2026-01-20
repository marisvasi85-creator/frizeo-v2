import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { differenceInHours } from "date-fns";

export async function POST(req: Request) {
  const { token } = await req.json();

  if (!token) {
    return NextResponse.json(
      { error: "Token lipsă" },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();

  /* 1️⃣ Luăm booking-ul */
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("cancel_token", token)
    .single();

  if (!booking || error) {
    return NextResponse.json(
      { error: "Programare inexistentă" },
      { status: 404 }
    );
  }

  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "Programarea este deja anulată" },
      { status: 400 }
    );
  }

  /* 2️⃣ Luăm limita de anulare */
  const { data: settings } = await supabase
    .from("barber_settings")
    .select("cancel_limit_hours")
    .eq("barber_id", booking.barber_id)
    .single();

  const cancelLimit = settings?.cancel_limit_hours ?? 0;

  /* 3️⃣ Verificare timp */
  const bookingDateTime = new Date(
    `${booking.booking_date}T${booking.booking_time}`
  );

  const diffHours = differenceInHours(bookingDateTime, new Date());

  if (diffHours < cancelLimit) {
    return NextResponse.json(
      { error: "Nu mai poți anula această programare" },
      { status: 400 }
    );
  }

  /* 4️⃣ Anulare */
  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id);

  return NextResponse.json({
    message: "Programarea a fost anulată cu succes",
  });
}

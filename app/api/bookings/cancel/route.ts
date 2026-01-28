import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json();

  const { booking_id, cancel_reason } = body;

  if (!booking_id) {
    return NextResponse.json(
      { error: "Missing booking_id" },
      { status: 400 }
    );
  }

  // 1️⃣ marcăm booking-ul ca anulat
  const { error: bookingError } = await supabase
    .from("bookings")
    .update({
      cancelled: true,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", booking_id);

  if (bookingError) {
    return NextResponse.json(
      { error: bookingError.message },
      { status: 400 }
    );
  }

  // 2️⃣ salvăm motivul anulării (dacă există)
  if (cancel_reason) {
    await supabase.from("booking_cancellations").insert({
      booking_id,
      reason: cancel_reason,
    });
  }

  return NextResponse.json({ success: true });
}

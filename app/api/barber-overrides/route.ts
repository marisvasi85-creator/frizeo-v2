import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/*
  Body așteptat:
  {
    barber_id: string;
    date: string;          // YYYY-MM-DD
    is_closed: boolean;    // true = zi închisă
    start_time?: string;   // HH:mm
    end_time?: string;     // HH:mm
  }
*/

export async function POST(req: Request) {
const supabase = await createClient();

  const body = await req.json();

  const {
    barber_id,
    date,
    is_closed,
    start_time,
    end_time,
  } = body;

  // ===============================
  // 1️⃣ VALIDARE DE BAZĂ
  // ===============================
  if (!barber_id || !date) {
    return NextResponse.json(
      { error: "barber_id și date sunt obligatorii" },
      { status: 400 }
    );
  }

  if (!is_closed) {
    if (!start_time || !end_time) {
      return NextResponse.json(
        { error: "start_time și end_time sunt obligatorii pentru slot" },
        { status: 400 }
      );
    }

    if (start_time >= end_time) {
      return NextResponse.json(
        { error: "start_time trebuie să fie înainte de end_time" },
        { status: 400 }
      );
    }
  }

  // ===============================
  // 2️⃣ VERIFICARE BOOKING-URI EXISTENTE
  // ===============================
  if (is_closed) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("barber_id", barber_id)
      .eq("date", date)
      .limit(1);

    if (bookings && bookings.length > 0) {
      return NextResponse.json(
        { error: "Există booking-uri în această zi" },
        { status: 409 }
      );
    }
  }

  // ===============================
  // 3️⃣ VERIFICARE OVERLAP CU ALTE OVERRIDE-URI
  // ===============================
  const { data: existingOverrides } = await supabase
    .from("barber_overrides")
    .select("*")
    .eq("barber_id", barber_id)
    .eq("date", date);

  if (existingOverrides && existingOverrides.length > 0) {
    for (const o of existingOverrides) {
      // zi deja închisă
      if (o.is_closed) {
        return NextResponse.json(
          { error: "Ziua este deja închisă" },
          { status: 409 }
        );
      }

      // overlap slot
      if (!is_closed) {
        if (
          start_time! < o.end_time &&
          end_time! > o.start_time
        ) {
          return NextResponse.json(
            { error: "Intervalul se suprapune cu un override existent" },
            { status: 409 }
          );
        }
      }
    }
  }

  // ===============================
  // 4️⃣ ȘTERGE OVERRIDE-URI VECHI DIN ACEA ZI
  // ===============================
  await supabase
    .from("barber_overrides")
    .delete()
    .eq("barber_id", barber_id)
    .eq("date", date);

  // ===============================
  // 5️⃣ INSERARE OVERRIDE NOU
  // ===============================
  const { error } = await supabase
    .from("barber_overrides")
    .insert({
      barber_id,
      date,
      is_closed,
      start_time: is_closed ? null : start_time,
      end_time: is_closed ? null : end_time,
    });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

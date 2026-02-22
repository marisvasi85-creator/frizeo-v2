import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* =========================
   GET override (barber + date)
========================= */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date"); // YYYY-MM-DD

  const supabase = await createSupabaseServerClient();

  if (!barberId || !date) {
    return NextResponse.json(
      { error: "Missing barberId or date" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("barber_day_overrides")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", date)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch override" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? null);
}

/* =========================
   CREATE / UPDATE override
========================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      barber_id,
      date,
      is_closed,
      work_start,
      work_end,
      break_enabled,
      break_start,
      break_end,
      slot_duration,
    } = body ?? {};

    if (!barber_id || !date) {
      return NextResponse.json(
        { error: "Missing barber_id or date" },
        { status: 400 }
      );
    }

    const payload = {
      barber_id,
      date,
      is_closed: is_closed ?? false,
      work_start: is_closed ? null : work_start ?? null,
      work_end: is_closed ? null : work_end ?? null,
      break_enabled: is_closed ? false : break_enabled ?? false,
      break_start:
        is_closed || !break_enabled ? null : break_start ?? null,
      break_end:
        is_closed || !break_enabled ? null : break_end ?? null,
      slot_duration: is_closed ? null : slot_duration ?? null,
    };

    // UPSERT pe (barber_id, date)
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("barber_day_overrides")
      .upsert(payload, {
        onConflict: "barber_id,date",
      });

    if (error) {
      return NextResponse.json(
        { error: "Failed to save override" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Override saved",
    });
  } catch (err) {
    console.error("OVERRIDE SAVE ERROR:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/* =========================
   DELETE override
========================= */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");

  const supabase = await createSupabaseServerClient();

  if (!barberId || !date) {
    return NextResponse.json(
      { error: "Missing barberId or date" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("barber_day_overrides")
    .delete()
    .eq("barber_id", barberId)
    .eq("date", date);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete override" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Override deleted",
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* =========================
   GET override(s)
========================= */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const date = searchParams.get("date");

    const supabase = await createSupabaseServerClient();

    if (!barberId) {
      return NextResponse.json(
        { error: "Missing barberId" },
        { status: 400 }
      );
    }

    if (date) {
      const { data, error } = await supabase
        .from("barber_day_overrides")
        .select("*")
        .eq("barber_id", barberId)
        .eq("date", date)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json(data ?? null);
    }

    const { data, error } = await supabase
      .from("barber_day_overrides")
      .select("*")
      .eq("barber_id", barberId)
      .order("date");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      overrides: data || [],
    });

  } catch (err) {
    console.error("OVERRIDE GET ERROR:", err);

    return NextResponse.json(
      { error: "GET ERROR" },
      { status: 500 }
    );
  }
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

    const supabase = await createSupabaseServerClient();

    // 🔥 IMPORTANT PENTRU RLS
    const { data: barber, error: barberError } = await supabase
      .from("barbers")
      .select("tenant_id")
      .eq("id", barber_id)
      .single();

    if (barberError || !barber) {
      return NextResponse.json(
        { error: "Barber not found" },
        { status: 404 }
      );
    }

    const payload = {
      barber_id,
      tenant_id: barber.tenant_id,

      date,
      is_closed: is_closed ?? false,

      break_enabled: is_closed
        ? false
        : break_enabled ?? false,

      break_start:
        is_closed || !break_enabled
          ? null
          : break_start ?? null,

      break_end:
        is_closed || !break_enabled
          ? null
          : break_end ?? null,

      slot_duration:
        is_closed
          ? null
          : slot_duration ?? null,
    };

    const { data, error } = await supabase
      .from("barber_day_overrides")
      .upsert(payload, {
        onConflict: "barber_id,date",
      })
      .select();

    if (error) {
      console.error("OVERRIDE UPSERT ERROR:", error);

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (err) {
    console.error("OVERRIDE POST ERROR:", err);

    return NextResponse.json(
      { error: "POST ERROR" },
      { status: 500 }
    );
  }
}

/* =========================
   DELETE override
========================= */
export async function DELETE(req: NextRequest) {
  try {
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
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (err) {
    console.error("OVERRIDE DELETE ERROR:", err);

    return NextResponse.json(
      { error: "DELETE ERROR" },
      { status: 500 }
    );
  }
}
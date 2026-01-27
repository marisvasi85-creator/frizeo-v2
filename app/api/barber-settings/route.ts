import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET barber settings (READ-ONLY)
 * ?barberId=UUID
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barberId = searchParams.get("barberId");

    if (!barberId) {
      return NextResponse.json(
        { error: "barberId lipsă" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("barber_settings")
      .select(`
        barber_id,
        tenant_id,
        slot_duration,
        start_time,
        end_time,
        working_days,
        break_enabled,
        break_start,
        break_end
      `)
      .eq("barber_id", barberId)
      .single();

    if (error || !data) {
      console.error("Barber settings error:", error);
      return NextResponse.json(
        { error: "Setările frizerului nu au fost găsite" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      settings: data,
    });
  } catch (err) {
    console.error("Barber settings exception:", err);
    return NextResponse.json(
      { error: "Eroare server" },
      { status: 500 }
    );
  }
}

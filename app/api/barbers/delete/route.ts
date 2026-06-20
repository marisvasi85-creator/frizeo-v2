import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const { barberId } = await req.json();

    if (!barberId) {
      return NextResponse.json(
        { error: "Barber invalid" },
        { status: 400 }
      );
    }

    // =========================
    // BARBER
    // =========================

    const { data: barber } = await supabase
      .from("barbers")
      .select("id,user_id")
      .eq("id", barberId)
      .single();

    if (!barber) {
      return NextResponse.json(
        { error: "Frizer inexistent" },
        { status: 404 }
      );
    }

    // =========================
    // ROLE
    // =========================

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("role")
      .eq("user_id", barber.user_id)
      .single();

    if (tenantUser?.role === "owner") {
      return NextResponse.json(
        {
          error:
            "Owner-ul salonului nu poate fi șters",
        },
        { status: 400 }
      );
    }

    // =========================
    // BOOKINGS
    // =========================

    const { count } = await supabase
      .from("bookings")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("barber_id", barberId);

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Frizerul are programări și nu poate fi șters",
        },
        { status: 400 }
      );
    }

    // =========================
    // DELETE RELATED DATA
    // =========================

    await supabase
      .from("barber_weekly_schedule")
      .delete()
      .eq("barber_id", barberId);

    await supabase
      .from("barber_day_overrides")
      .delete()
      .eq("barber_id", barberId);

    await supabase
      .from("barber_settings")
      .delete()
      .eq("barber_id", barberId);

    await supabase
      .from("barber_services")
      .delete()
      .eq("barber_id", barberId);

    await supabase
      .from("barbers")
      .delete()
      .eq("id", barberId);

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
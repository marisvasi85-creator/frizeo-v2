import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("barber_weekly_schedule")
      .select("*")
      .eq("barber_id", barber.id)
      .order("day_of_week", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
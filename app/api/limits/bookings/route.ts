import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: barber } = await supabase
      .from("barbers")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!barber) {
      return NextResponse.json(
        { error: "Barber not found" },
        { status: 404 }
      );
    }

    const plan = await getCurrentPlan(
      barber.tenant_id
    );

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    const now = new Date();

    const firstDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    )
      .toISOString()
      .slice(0, 10);

    const { count } = await supabase
      .from("bookings")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("tenant_id", barber.tenant_id)
      .gte("date", firstDay)
      .neq("status", "cancelled");

    return NextResponse.json({
      plan: plan.name,
      currentBookings: count || 0,
      limit: plan.max_bookings_per_month,
      unlimited:
        plan.max_bookings_per_month === null,
    });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
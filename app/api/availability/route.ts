import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDays, format } from "date-fns";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!barberId || !from || !to) {
      return NextResponse.json({ availability: {} }, { status: 400 });
    }

    // 🔥 Get active tenant
    const tenant = await getActiveTenant();
    const tenantId = tenant?.tenant_id;

    if (!tenantId) {
      return NextResponse.json({ availability: {} }, { status: 403 });
    }

    /* =========================
       WEEKLY SCHEDULE
    ========================= */
    const { data: weekly, error: weeklyError } = await supabase
      .from("barber_weekly_schedule")
      .select("day_of_week, is_working")
      .eq("barber_id", barberId)
      .eq("tenant_id", tenantId);

    if (weeklyError) {
      console.error("WEEKLY ERROR:", weeklyError);
      return NextResponse.json({ availability: {} }, { status: 500 });
    }

    const weeklyMap = new Map<number, boolean>(
      weekly?.map((w) => [w.day_of_week, w.is_working]) ?? []
    );

    /* =========================
       DAY OVERRIDES
    ========================= */
    const { data: overrides, error: overrideError } = await supabase
      .from("barber_day_overrides")
      .select("date, is_closed")
      .eq("barber_id", barberId)
      .eq("tenant_id", tenantId);

    if (overrideError) {
      console.error("OVERRIDE ERROR:", overrideError);
      return NextResponse.json({ availability: {} }, { status: 500 });
    }

    const overrideMap = new Map<string, boolean>(
      overrides?.map((o) => [o.date, o.is_closed]) ?? []
    );

    /* =========================
       BUILD AVAILABILITY
    ========================= */

    const availability: Record<string, boolean> = {};

    let current = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");

    while (current <= end) {
      const dateStr = format(current, "yyyy-MM-dd");

      const jsDay = current.getDay(); // 0–6
      const dayOfWeek = jsDay === 0 ? 7 : jsDay; // 1–7

      const isWorking = weeklyMap.get(dayOfWeek) === true;
      const isClosed = overrideMap.get(dateStr) === true;

      availability[dateStr] = isWorking && !isClosed;

      current = addDays(current, 1);
    }

    return NextResponse.json({ availability });

  } catch (err) {
    console.error("AVAILABILITY ERROR:", err);
    return NextResponse.json({ availability: {} }, { status: 500 });
  }
}
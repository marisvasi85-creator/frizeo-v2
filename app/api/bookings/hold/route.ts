import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  try {
    const supabase = createSupabasePublicClient();
    const body = await req.json();

    const {
      barber_id,
      barber_service_id,
      date,
      start_time,
    } = body;

    if (!barber_id || !barber_service_id || !date || !start_time) {
      return NextResponse.json(
        { error: "Date invalide" },
        { status: 400 }
      );
    }

    // =========================
    // 🔥 SERVICE
    // =========================
    const { data: service } = await supabase
      .from("barber_services")
      .select("duration")
      .eq("id", barber_service_id)
      .single();

    if (!service) {
      return NextResponse.json(
        { error: "Serviciu invalid" },
        { status: 400 }
      );
    }

    // =========================
    // 🔥 SETTINGS
    // =========================
    const { data: settings } = await supabase
      .from("barber_settings")
      .select("break_between_enabled, break_between_minutes")
      .eq("barber_id", barber_id)
      .single();

    const breakEnabled = settings?.break_between_enabled ?? false;
    const breakMinutes = settings?.break_between_minutes ?? 0;

    const effectiveDuration = breakEnabled
      ? service.duration + breakMinutes
      : service.duration;

    const startMin = timeToMinutes(start_time);
    const endMin = startMin + effectiveDuration;
    const end_time = minutesToTime(endMin);

    // =========================
    // 🔥 TENANT
    // =========================
    const { data: barber } = await supabase
      .from("barbers")
      .select("tenant_id")
      .eq("id", barber_id)
      .single();

    if (!barber) {
      return NextResponse.json(
        { error: "Barber invalid" },
        { status: 400 }
      );
    }

    // =========================
    // 🔥 OVERLAP CHECK (IDENTIC cu slots)
    // =========================
    const { data: existing } = await supabase
      .from("bookings")
      .select("start_time, end_time, status, expires_at")
      .eq("barber_id", barber_id)
      .eq("date", date);

    const now = new Date();

    const active = (existing || []).filter((b: any) => {
      if (b.status === "confirmed") return true;
      if (b.status === "pending" && b.expires_at) {
        return new Date(b.expires_at) > now;
      }
      return false;
    });

    const overlap = active.some((b: any) => {
      return (
        startMin < timeToMinutes(b.end_time) &&
        endMin > timeToMinutes(b.start_time)
      );
    });

    if (overlap) {
      return NextResponse.json(
        { error: "Slot ocupat" },
        { status: 400 }
      );
    }

    // =========================
    // 🔥 HOLD
    // =========================
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        barber_id,
        barber_service_id,
        tenant_id: barber.tenant_id,
        date,
        start_time,
        end_time,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        cancel_token: crypto.randomUUID(),
        reschedule_token: crypto.randomUUID(),
      })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Nu se poate crea hold" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      holdId: data.id,
      end_time,
      expiresAt: data.expires_at,
    });

  } catch (err) {
    console.error("HOLD ERROR:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
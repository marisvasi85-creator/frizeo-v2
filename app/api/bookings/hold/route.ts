import { NextResponse } from "next/server";
import { requireManagedBarber } from "@/lib/barber-access/authorization";
import { reservePendingHold } from "@/lib/bookings/reservePendingHold";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: Request) {
  try {
    const limited = await enforceRateLimit(req, {
      bucket: "booking-hold",
      limit: 30,
      windowSeconds: 600,
    });
    if (limited) return limited;

    const body = await req.json();
    const {
      barber_id,
      barber_service_id,
      date,
      start_time,
      client_phone,
      booking_context,
    } = body;

    if (!barber_id || !barber_service_id || !date || !start_time) {
      return NextResponse.json(
        { error: "Date invalide" },
        { status: 400 },
      );
    }

    let isDashboardBooking = false;
    let bypassMinNotice = false;
    let bypassGoogleBusy = false;
    const dashboardContext = booking_context === "dashboard"
      ? await requireManagedBarber(barber_id)
      : null;

    if (dashboardContext instanceof NextResponse) return dashboardContext;

    if (dashboardContext) {
      isDashboardBooking = true;
      bypassMinNotice = true;
      bypassGoogleBusy = true;
    }

    const reserved = await reservePendingHold({
      barberId: barber_id,
      barberServiceId: barber_service_id,
      date,
      startTime: start_time,
      clientPhone: client_phone,
      isDashboardBooking,
      bypassMinNotice,
      bypassGoogleBusy,
    });

    if (!reserved.ok) {
      return NextResponse.json(
        reserved.accessStatus
          ? { error: reserved.error, accessStatus: reserved.accessStatus }
          : { error: reserved.error },
        { status: reserved.status },
      );
    }

    return NextResponse.json({
      holdId: reserved.hold.id,
      end_time: reserved.hold.end_time,
      expiresAt: reserved.hold.expires_at,
    });
  } catch (err) {
    console.error("HOLD ERROR:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 },
    );
  }
}

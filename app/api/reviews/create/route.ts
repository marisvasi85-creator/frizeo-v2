import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSalonReviewsTable } from "@/lib/reviews/salonReviews";

export async function POST(req: Request) {
  try {
    if (!(await hasSalonReviewsTable())) {
      return NextResponse.json(
        { error: "Recenziile nu sunt activate încă." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const token = String(body.token || "").trim();
    const rating = Number(body.rating);
    const comment =
      typeof body.comment === "string" ? body.comment.trim().slice(0, 800) : "";

    if (!token) {
      return NextResponse.json({ error: "Token lipsă." }, { status: 400 });
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Alege o notă între 1 și 5." },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id, tenant_id, client_name, status")
      .eq("cancel_token", token)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Programarea nu a fost găsită." },
        { status: 404 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "Nu poți lăsa recenzie pentru o programare anulată." },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("salon_reviews")
      .select("id")
      .eq("booking_id", booking.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Ai lăsat deja o recenzie pentru această programare." },
        { status: 409 }
      );
    }

    const authorName =
      (typeof booking.client_name === "string" &&
        booking.client_name.trim()) ||
      "Client";

    const { error: insertError } = await supabaseAdmin
      .from("salon_reviews")
      .insert({
        tenant_id: booking.tenant_id,
        booking_id: booking.id,
        rating: Math.round(rating),
        author_name: authorName.slice(0, 80),
        comment: comment || null,
        approved: true,
      });

    if (insertError) {
      console.error("review insert:", insertError);
      return NextResponse.json(
        { error: "Nu am putut salva recenzia." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("review POST:", err);
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}

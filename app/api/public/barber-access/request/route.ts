import { NextResponse } from "next/server";
import {
  checkBarberBookingAccess,
  getBarberAccessMode,
  publicAccessMessage,
} from "@/lib/barber-access/server";
import { notifyBarberAboutAccessRequest } from "@/lib/barber-access/notifications";
import { normalizeRomanianPhone } from "@/lib/phone/normalizeRomanianPhone";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const barberId = typeof body?.barberId === "string" ? body.barberId : "";
    const clientName = optionalText(body?.name, 160);
    const rawPhone = typeof body?.phone === "string" ? body.phone : "";
    const clientEmail = optionalText(body?.email, 320)?.toLowerCase() ?? null;
    const referral = optionalText(body?.referral, 240);
    const message = optionalText(body?.message, 1200);
    const phoneNormalized = normalizeRomanianPhone(rawPhone);

    if (!barberId || !clientName || !phoneNormalized) {
      return NextResponse.json(
        { error: "Completează numele și un număr de telefon valid." },
        { status: 400 },
      );
    }

    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return NextResponse.json(
        { error: "Adresa de e-mail nu este validă." },
        { status: 400 },
      );
    }

    const limited = await enforceRateLimit(req, {
      bucket: "barber-access-request",
      identifier: barberId,
      limit: 5,
      windowSeconds: 3600,
    });
    if (limited) return limited;

    const { barber, mode, schemaReady } = await getBarberAccessMode(barberId);
    if (!schemaReady) {
      return NextResponse.json(
        { error: "Funcționalitatea nu este activată încă." },
        { status: 503 },
      );
    }

    if (!barber || barber.active !== true) {
      return NextResponse.json(
        { error: "Profesionist indisponibil." },
        { status: 404 },
      );
    }

    if (mode === "approved_only") {
      return NextResponse.json(
        {
          error:
            "Acest profesionist nu acceptă momentan clienți noi. Programările sunt disponibile doar pentru clienții deja acceptați.",
        },
        { status: 403 },
      );
    }

    if (mode !== "approval_required") {
      return NextResponse.json(
        { error: "Programările sunt deschise; poți continua direct." },
        { status: 409 },
      );
    }

    const current = await checkBarberBookingAccess({
      barberId,
      phone: phoneNormalized,
    });

    if (current.status === "approved" || current.status === "pending") {
      return NextResponse.json({
        status: current.status,
        canBook: current.canBook,
        message: publicAccessMessage(current),
      });
    }

    // Conservative MVP rule: rejected requests are not automatically reopened.
    // The barber/owner may set them to pending or approved from the dashboard.
    if (current.status === "rejected" || current.status === "blocked") {
      return NextResponse.json(
        { status: current.status, error: publicAccessMessage(current) },
        { status: 403 },
      );
    }

    const { error } = await supabaseAdmin.from("barber_client_access").insert({
      tenant_id: barber.tenant_id,
      barber_id: barberId,
      phone_normalized: phoneNormalized,
      client_name: clientName,
      client_email: clientEmail,
      referral,
      request_message: message,
      status: "pending",
      source: "client_request",
      requested_at: new Date().toISOString(),
    });

    if (error?.code === "23505") {
      const latest = await checkBarberBookingAccess({
        barberId,
        phone: phoneNormalized,
      });

      if (latest.status === "blocked" || latest.status === "rejected") {
        return NextResponse.json(
          { status: latest.status, error: publicAccessMessage(latest) },
          { status: 403 },
        );
      }

      return NextResponse.json({
        status: latest.status,
        canBook: latest.canBook,
        message: publicAccessMessage(latest),
      });
    }

    if (error) throw error;

    notifyBarberAboutAccessRequest({
      barberId,
      clientName,
      clientPhone: rawPhone,
      clientEmail,
      referral,
      message,
    }).catch((notifyError) => {
      console.error("BARBER ACCESS REQUEST EMAIL:", notifyError);
    });

    return NextResponse.json({
      status: "pending",
      canBook: false,
      message:
        "Solicitarea a fost trimisă. Vei putea continua după ce profesionistul o aprobă.",
    });
  } catch (error) {
    console.error("PUBLIC BARBER ACCESS REQUEST:", error);
    return NextResponse.json(
      { error: "Nu am putut trimite solicitarea. Încearcă din nou." },
      { status: 500 },
    );
  }
}

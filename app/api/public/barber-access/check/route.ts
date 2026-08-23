import { NextResponse } from "next/server";
import {
  checkBarberBookingAccess,
  publicAccessMessage,
} from "@/lib/barber-access/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const barberId = typeof body?.barberId === "string" ? body.barberId : "";
    const phone = typeof body?.phone === "string" ? body.phone : "";

    if (!barberId || !phone) {
      return NextResponse.json(
        { error: "Frizerul și telefonul sunt obligatorii." },
        { status: 400 },
      );
    }

    const limited = await enforceRateLimit(req, {
      bucket: "barber-access-check",
      identifier: barberId,
      limit: 30,
      windowSeconds: 600,
    });
    if (limited) return limited;

    const result = await checkBarberBookingAccess({ barberId, phone });

    return NextResponse.json({
      accessMode: result.accessMode,
      status: result.status,
      canBook: result.canBook,
      message: publicAccessMessage(result),
    });
  } catch (error) {
    console.error("PUBLIC BARBER ACCESS CHECK:", error);
    return NextResponse.json(
      { error: "Nu am putut verifica accesul. Încearcă din nou." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");

  if (!barberId || !date || !serviceId) {
    return NextResponse.json({ slots: [] });
  }

  // aici TU ai deja logica ta de generare sloturi
  // endpointul doar o expune
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_barber_id: barberId,
    p_date: date,
    p_service_id: serviceId,
  });

  if (error) {
    return NextResponse.json({ slots: [] });
  }

  return NextResponse.json({ slots: data || [] });
}

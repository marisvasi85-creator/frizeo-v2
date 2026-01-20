import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json();

  const { barber_id, ...rest } = body;

  // 1️⃣ Luăm tenant_id din barbers
  const { data: barber } = await supabase
    .from("barbers")
    .select("tenant_id")
    .eq("id", barber_id)
    .single();

  if (!barber?.tenant_id) {
    return NextResponse.json({ error: "Tenant lipsă" }, { status: 400 });
  }

  // 2️⃣ Salvăm settings CU tenant_id
  const { error } = await supabase
    .from("barber_settings")
    .upsert({
      barber_id,
      tenant_id: barber.tenant_id,
      ...rest,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}


import { NextResponse } from "next/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return NextResponse.json({ barbers: [] }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("barbers")
      .select(`
  id,
  display_name,
  phone,
  active,
  slug,
  tenant_id
`)
      .eq("tenant_id", barber.tenant_id)
      .order("display_name");

    if (error) {
      console.error("BARBERS FETCH ERROR:", error);

      return NextResponse.json(
        { barbers: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      barbers: data || [],
    });

  } catch (err) {
    console.error("BARBERS API ERROR:", err);

    return NextResponse.json(
      { barbers: [] },
      { status: 500 }
    );
  }
}
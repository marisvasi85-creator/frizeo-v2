import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { canCreateBarber } from "@/lib/limits/checkBarberLimit";

export async function POST(req: Request) {
  try {
    const supabase = createSupabasePublicClient();
    const body = await req.json();

    const { tenantId, name } = body;

    if (!tenantId || !name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 🔥 LIMITARE
    const allowed = await canCreateBarber(tenantId);

    if (!allowed) {
      return NextResponse.json(
        { error: "Ai atins limita de frizeri pentru planul tău" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("barbers")
      .insert({
        tenant_id: tenantId,
        display_name: name,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Insert failed" }, { status: 400 });
    }

    return NextResponse.json(data);

  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
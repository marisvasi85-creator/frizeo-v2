import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    // 🔥 user logat
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ profile: null }, { status: 401 });
    }

    // 🔥 găsim barber după user_id
    const { data: barber } = await supabase
  .from("barbers")
  .select(`
    id,
    display_name,
    tenant_id
  `)
  .eq("user_id", user.id)
  .single();

    if (!barber) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: barber,
    });

  } catch (err) {
    console.error("BARBER ME ERROR:", err);
    return NextResponse.json({ profile: null }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    return NextResponse.json({
      invitations: [],
    });
  }

  const { data } = await supabase
    .from("barber_invitations")
    .select(`
      id,
      full_name,
      email,
      phone,
      accepted,
      created_at
    `)
    .eq("tenant_id", barber.tenant_id)
    .order("created_at", {
      ascending: false,
    });

  return NextResponse.json({
    invitations: data || [],
  });
}
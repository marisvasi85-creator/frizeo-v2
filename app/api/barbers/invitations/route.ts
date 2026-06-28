import { NextResponse } from "next/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    return NextResponse.json({ invitations: [] }, { status: 401 });
  }

  const role = await getCurrentRole();

  if (role !== "owner" && role !== "manager") {
    return NextResponse.json({ invitations: [] }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
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
    .eq("accepted", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("barbers/invitations:", error);
    return NextResponse.json(
      { invitations: [], error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    invitations: data || [],
  });
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ bookings: [] });
  }

  const role = await getCurrentRole();

  const { data: barber } = await supabase
    .from("barbers")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!barber) {
    return Response.json({ bookings: [] });
  }

  let query = supabase
    .from("bookings")
    .select(`
  *,
  barber_services:barber_services!bookings_barber_service_id_fkey (
    display_name,
    name,
    duration
  ),
  barber:barbers (
    display_name
  )
`)
    .neq("status", "cancelled");

  // OWNER -> toate programările salonului
  if (role === "owner") {
    query = query.eq(
      "tenant_id",
      barber.tenant_id
    );
  }

  // BARBER -> doar programările lui
  else {
    query = query.eq(
      "barber_id",
      barber.id
    );
  }

  const { data, error } = await query
    .order("date", {
      ascending: false,
    })
    .order("start_time", {
      ascending: false,
    });

  if (error) {
    console.error(error);

    return Response.json({
      bookings: [],
    });
  }

  return Response.json({
    bookings: data || [],
  });
}
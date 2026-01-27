import { supabase } from "./client";

export async function getCurrentBarber() {
  // 1️⃣ user logat
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.log("NU există user logat");
    return null;
  }

  // 2️⃣ barber legat de user
  const { data: barber, error } = await supabase
    .from("barbers")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error || !barber) {
    console.log("NU există barber pentru user", user.id);
    return null;
  }

  return barber;
}

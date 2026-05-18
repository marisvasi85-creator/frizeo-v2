import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";
import AdminCalendarClient from "./AdminCalendarClient";

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const barber = await getCurrentBarberInTenant();

  if (!barber) redirect("/login");

  return (
    <AdminCalendarClient barberId={barber.id} />
  );
}
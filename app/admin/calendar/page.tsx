// app/admin/calendar/page.tsx

import { redirect } from "next/navigation";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import AdminCalendarClient from "./AdminCalendarClient";

export default async function AdminCalendarPage() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  return <AdminCalendarClient barberId={barber.id} />;
}

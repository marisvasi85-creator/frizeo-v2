// app/admin/settings/page.tsx

import { redirect } from "next/navigation";
import WeeklyScheduleEditor from "./components/WeeklyScheduleEditor";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

export default async function AdminSettingsPage() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <h1>Setări</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Program săptămânal</h2>

        <WeeklyScheduleEditor barberId={barber.id} />
      </section>
    </div>
  );
}
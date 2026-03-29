import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { getDashboardStatus } from "@/lib/onboarding/getDashboardStatus";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const barber = await getCurrentBarberInTenant();
  if (!barber) redirect("/login");

  const status = await getDashboardStatus(user.id);

  if (!status.completed) {
    if (status.step === "services") redirect("/admin/services");
    if (status.step === "schedule") redirect("/admin/settings");
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: todayBookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("barber_id", barber.id)
    .eq("date", today);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("barber_id", barber.id)
    .order("date", { ascending: true })
    .limit(5);

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-semibold">
          Salut, {barber.display_name} 👋
        </h1>
        <p className="text-white/60 mt-1">
          Iată ce se întâmplă azi în salonul tău
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-[#161618] p-5 rounded-xl border border-white/10">
          <p className="text-sm text-white/60">Programări azi</p>
          <p className="text-3xl font-bold mt-2">
            {todayBookings?.length || 0}
          </p>
        </div>

        <div className="bg-[#161618] p-5 rounded-xl border border-white/10">
          <p className="text-sm text-white/60">Status</p>
          <p className="text-lg mt-2">
            {todayBookings && todayBookings.length > 0
              ? "Ai clienți azi"
              : "Zi liberă"}
          </p>
        </div>

        <div className="bg-[#161618] p-5 rounded-xl border border-white/10">
          <p className="text-sm text-white/60">Total programări</p>
          <p className="text-3xl font-bold mt-2">
            {bookings?.length || 0}
          </p>
        </div>

      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-[#161618] p-6 rounded-xl border border-white/10">
        <h2 className="text-lg font-semibold mb-4">
          Acțiuni rapide
        </h2>

        <div className="flex gap-3 flex-wrap">

          <a
            href="/admin/calendar"
            className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:opacity-90"
          >
            Calendar
          </a>

          <a
            href="/admin/bookings"
            className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20"
          >
            Programări
          </a>

          <a
            href="/admin/services"
            className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20"
          >
            Servicii
          </a>

        </div>
      </div>

      {/* RECENT BOOKINGS */}
      <div className="bg-[#161618] p-6 rounded-xl border border-white/10">
        <h2 className="text-lg font-semibold mb-4">
          Ultimele programări
        </h2>

        {!bookings || bookings.length === 0 ? (
          <p className="text-white/60">
            Nu există programări.
          </p>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="flex justify-between items-center p-3 rounded-lg bg-[#0F0F10]"
              >
                <div>
                  <p className="font-medium">
                    {booking.client_name}
                  </p>
                  <p className="text-sm text-white/60">
                    {booking.date} – {booking.start_time}
                  </p>
                </div>

                <span className="text-xs px-2 py-1 rounded bg-white/10">
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
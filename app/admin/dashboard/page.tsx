import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import getDashboardStatus from "@/lib/onboarding/getDashboardStatus";
import BookingLinkCard from "./BookingLinkCard";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";

export default async function DashboardPage() {  const supabase = await createSupabaseServerClient();
const role = await getCurrentRole();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }
  const currentPlan =
  await getCurrentPlan(
    barber.tenant_id
  );

  const status = await getDashboardStatus(user.id);

  if (!status.completed) {
    if (status.step === "services") {
      redirect("/admin/services");
    }

    if (status.step === "schedule") {
      redirect("/admin/settings");
    }
  }

  const today =
    new Date().toISOString().split("T")[0];

  const { data: todayBookings } =
    await supabase
      .from("bookings")
      .select("*")
      .eq("barber_id", barber.id)
      .eq("date", today)
      .eq("status", "confirmed");

  const { data: upcoming } =
    await supabase
      .from("bookings")
      .select("*")
      .eq("barber_id", barber.id)
      .eq("status", "confirmed")
      .gt("date", today)
      .order("date", { ascending: true })
      .order("start_time", {
        ascending: true,
      })
      .limit(5);

  
  return (
    <div className="space-y-8 min-w-0">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-semibold">
          Salut, {barber.display_name} 👋
        </h1>
        <p className="text-white/60 mt-1">
          Panoul tău de control
        </p>
      </div>

      {/* 🔥 BOOKING LINK (CLIENT COMPONENT) */}
<BookingLinkCard />
{role === "owner" && (
  <div className="bg-[#161618] p-6 rounded-xl border border-white/10">
    <h2 className="text-lg font-semibold mb-4">
      Administrare salon
    </h2>

    <div className="flex flex-col sm:flex-row flex-wrap gap-3">

      <a
        href="/admin/barbers"
        className="px-4 py-2 bg-white/10 rounded-lg text-sm"
      >
        Frizeri
      </a>

      <a
        href="/admin/salon"
        className="px-4 py-2 bg-white/10 rounded-lg text-sm"
      >
        Salon
      </a>

      <a
        href="/admin/billing"
        className="px-4 py-2 bg-white/10 rounded-lg text-sm"
      >
        Abonament
      </a>

    </div>
  </div>
)}
{currentPlan?.status === "trialing" &&
  currentPlan?.trial_ends_at && (() => {

    const daysLeft = Math.max(
      0,
      Math.ceil(
        (
          new Date(currentPlan.trial_ends_at).getTime() -
          Date.now()
        ) /
        (1000 * 60 * 60 * 24)
      )
    );

    return (
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">

        <div className="font-semibold text-blue-300">
          🎁 Trial activ
        </div>

        <p className="text-white/70 mt-2">
          Beneficiezi de toate funcțiile Frizeo.
        </p>

        <p className="text-white mt-3 font-medium">
          Mai ai {daysLeft} zile rămase.
        </p>

        <p className="text-white/50 text-sm mt-2">
          După expirare vei fi trecut pe planul Free.
        </p>

        <a
          href="/admin/billing"
          className="inline-block mt-4 px-4 py-2 bg-white text-black rounded-lg text-sm"
        >
          Vezi planurile
        </a>

      </div>
    );
  })()}
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
          <p className="text-sm text-white/60">Următoarea programare</p>
          <p className="text-lg mt-2">
            {upcoming && upcoming.length > 0
              ? `${upcoming[0].date} ${upcoming[0].start_time}`
              : "—"}
          </p>
        </div>

      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-[#161618] p-6 rounded-xl border border-white/10">
        <h2 className="text-lg font-semibold mb-4">
          Acțiuni rapide
        </h2>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3">

          <a
  href="/admin/bookings/new"
  className="w-full sm:w-auto px-4 py-2 bg-white text-black rounded-lg text-sm font-medium text-center"
>
  Adaugă programare
</a>

          <a
            href="/admin/bookings"
            className="w-full sm:w-auto px-4 py-2 bg-white text-black rounded-lg text-sm font-medium text-center"
          >
            Programări
          </a>

          <a
            href="/admin/services"
            className="w-full sm:w-auto px-4 py-2 bg-white text-black rounded-lg text-sm font-medium text-center"
          >
            Servicii
          </a>

          <a
            href="/admin/settings"
            className="w-full sm:w-auto px-4 py-2 bg-white text-black rounded-lg text-sm font-medium text-center"
          >
            Program
          </a>

        </div>
      </div>

      {/* AZI */}
      <div className="bg-[#161618] p-6 rounded-xl border border-white/10">
        <h2 className="text-lg font-semibold mb-4">
          Programările de azi
        </h2>

        {!todayBookings || todayBookings.length === 0 ? (
          <p className="text-white/60">Nu ai programări azi.</p>
        ) : (
          <div className="space-y-3">
            {todayBookings.map((b) => (
              <div
                key={b.id}
                className="flex justify-between items-center p-3 rounded-lg bg-[#0F0F10]"
              >
                <div>
                  <p className="font-medium">{b.client_name}</p>
                  <p className="text-sm text-white/60">
                    {b.start_time} - {b.end_time}
                  </p>
                </div>

                <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                  Confirmată
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* URMĂTOARELE */}
      <div className="bg-[#161618] p-6 rounded-xl border border-white/10">
        <h2 className="text-lg font-semibold mb-4">
          Următoarele programări
        </h2>

        {!upcoming || upcoming.length === 0 ? (
          <p className="text-white/60">Nu există programări.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <div
                key={b.id}
                className="flex justify-between items-center p-3 rounded-lg bg-[#0F0F10]"
              >
                <div>
                  <p className="font-medium">{b.client_name}</p>
                  <p className="text-sm text-white/60">
                    {b.date} - {b.start_time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
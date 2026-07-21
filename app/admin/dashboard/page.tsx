import { redirect } from "next/navigation";
import getDashboardStatus from "@/lib/onboarding/getDashboardStatus";
import BookingLinkCard from "./BookingLinkCard";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app/getAppUrl";
import { stableBookingUrl } from "@/lib/booking/publicBookingPath";
import AdminCard from "../components/AdminCard";
import AdminButton from "../components/AdminButton";

export default async function DashboardPage() {
  const session = await getAdminSession();

  if (!session?.user || !session.barber) {
    redirect("/login");
  }

  const { user, role, barber } = session;
  const today = new Date().toISOString().split("T")[0];

  const [currentPlan, status, todayRes, upcomingRes] = await Promise.all([
    getCurrentPlan(barber.tenant_id),
    getDashboardStatus(user.id, barber.id),
    supabaseAdmin
      .from("bookings")
      .select("id, client_name, start_time, end_time, date, status")
      .eq("barber_id", barber.id)
      .eq("date", today)
      .eq("status", "confirmed"),
    supabaseAdmin
      .from("bookings")
      .select("id, client_name, start_time, date, status")
      .eq("barber_id", barber.id)
      .eq("status", "confirmed")
      .gt("date", today)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(5),
  ]);

  if (!status.completed) {
    if (status.step === "services") {
      redirect("/admin/services");
    }

    if (status.step === "schedule") {
      redirect("/admin/settings");
    }
  }

  const todayBookings = todayRes.data;
  const upcoming = upcomingRes.data;
  const bookingUrl = stableBookingUrl(barber.id, getAppUrl());

  return (
    <div className="space-y-8 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold">
          Salut, {barber.display_name} 👋
        </h1>
        <p className="text-white/60 mt-1">Panoul tău de control</p>
      </div>

      <BookingLinkCard initialUrl={bookingUrl} />

      {role === "owner" && (
        <AdminCard>
          <h2 className="text-lg font-semibold mb-4">Administrare salon</h2>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <AdminButton variant="secondary" size="sm" href="/admin/barbers">
              Frizeri
            </AdminButton>

            <AdminButton variant="secondary" size="sm" href="/admin/salon">
              Salon
            </AdminButton>

            <AdminButton variant="secondary" size="sm" href="/admin/billing">
              Abonament
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {currentPlan?.status === "trialing" &&
        currentPlan?.trial_ends_at &&
        (() => {
          const daysLeft = Math.max(
            0,
            Math.ceil(
              (new Date(currentPlan.trial_ends_at).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
          );

          return (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
              <div className="font-semibold text-blue-300">🎁 Trial activ</div>

              <p className="text-white/70 mt-2">
                Beneficiezi de acces Pro+ (SMS, 3 frizeri, programări nelimitate).
              </p>

              <p className="text-white mt-3 font-medium">
                Mai ai {daysLeft} zile rămase.
              </p>

              <p className="text-white/50 text-sm mt-2">
                După expirare vei fi trecut pe planul Free.
              </p>

              <AdminButton
                size="sm"
                href="/admin/billing"
                className="inline-block mt-4"
              >
                Vezi planurile
              </AdminButton>
            </div>
          );
        })()}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard padding="sm">
          <p className="text-sm text-white/60">Programări azi</p>
          <p className="text-3xl font-bold mt-2">
            {todayBookings?.length || 0}
          </p>
        </AdminCard>

        <AdminCard padding="sm">
          <p className="text-sm text-white/60">Status</p>
          <p className="text-lg mt-2">
            {todayBookings && todayBookings.length > 0
              ? "Ai clienți azi"
              : "Zi liberă"}
          </p>
        </AdminCard>

        <AdminCard padding="sm">
          <p className="text-sm text-white/60">Următoarea programare</p>
          <p className="text-lg mt-2">
            {upcoming && upcoming.length > 0
              ? `${upcoming[0].date} ${upcoming[0].start_time}`
              : "—"}
          </p>
        </AdminCard>
      </div>

      <AdminCard>
        <h2 className="text-lg font-semibold mb-4">Acțiuni rapide</h2>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <AdminButton size="sm" href="/admin/bookings/new">
            Adaugă programare
          </AdminButton>

          <AdminButton size="sm" href="/admin/bookings">
            Programări
          </AdminButton>

          <AdminButton size="sm" href="/admin/services">
            Servicii
          </AdminButton>

          <AdminButton size="sm" href="/admin/settings">
            Program
          </AdminButton>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="text-lg font-semibold mb-4">Programările de azi</h2>

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
      </AdminCard>

      <AdminCard>
        <h2 className="text-lg font-semibold mb-4">Următoarele programări</h2>

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
      </AdminCard>
    </div>
  );
}

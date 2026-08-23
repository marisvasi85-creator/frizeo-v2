import { redirect } from "next/navigation";
import getDashboardStatus from "@/lib/onboarding/getDashboardStatus";
import BookingLinkCard from "./BookingLinkCard";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app/getAppUrl";
import {
  publicBookingUrl,
  publicSalonUrl,
  stableBookingUrl,
} from "@/lib/booking/publicBookingPath";
import { ensureBarberSlug } from "@/lib/barbers/ensureBarberSlug";
import { ensureTenantSlug } from "@/lib/tenant/ensureTenantSlug";
import AdminCard from "../components/AdminCard";
import AdminButton from "../components/AdminButton";
import SetupChecklist from "../components/SetupChecklist";
import { sessionActsAsBarber } from "../components/adminNav";

export default async function DashboardPage() {
  const session = await getAdminSession();

  if (!session?.user || !session.barber) {
    redirect("/login");
  }

  const { user, role, barber } = session;
  const actsAsBarber = sessionActsAsBarber(session);
  const today = new Date().toISOString().split("T")[0];
  const tenantId = barber.tenant_id;

  const bookingScope = actsAsBarber
    ? { column: "barber_id" as const, value: barber.id }
    : { column: "tenant_id" as const, value: tenantId };

  const [currentPlan, status, todayRes, upcomingRes, anyBookingRes, tenantRes] =
    await Promise.all([
      getCurrentPlan(tenantId),
      actsAsBarber
        ? getDashboardStatus(user.id, barber.id)
        : Promise.resolve({ step: "done" as const, completed: true }),
      supabaseAdmin
        .from("bookings")
        .select("id, client_name, start_time, end_time, date, status")
        .eq(bookingScope.column, bookingScope.value)
        .eq("date", today)
        .eq("status", "confirmed"),
      supabaseAdmin
        .from("bookings")
        .select("id, client_name, start_time, date, status")
        .eq(bookingScope.column, bookingScope.value)
        .eq("status", "confirmed")
        .gt("date", today)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(5),
      supabaseAdmin
        .from("bookings")
        .select("id")
        .eq(bookingScope.column, bookingScope.value)
        .limit(1),
      supabaseAdmin
        .from("tenants")
        .select("id, name, slug")
        .eq("id", tenantId)
        .single(),
    ]);

  if (actsAsBarber && !status.completed) {
    if (status.step === "services") {
      redirect("/admin/services");
    }

    if (status.step === "schedule") {
      redirect("/admin/settings");
    }
  }

  const todayBookings = todayRes.data;
  const upcoming = upcomingRes.data;
  const appUrl = getAppUrl();
  const tenant = tenantRes.data;
  const tenantSlug = tenant ? await ensureTenantSlug(tenant) : "";

  let bookingUrl = stableBookingUrl(barber.id, appUrl);
  let bookingLinkLabel = "Linkul tău de programări";

  if (!actsAsBarber && tenantSlug) {
    bookingUrl = publicSalonUrl(tenantSlug, appUrl);
    bookingLinkLabel = "Linkul public al salonului";
  } else if (tenantSlug) {
    const existingSlug =
      typeof barber.slug === "string" && barber.slug.trim()
        ? barber.slug
        : null;
    const barberSlug = await ensureBarberSlug({
      id: barber.id,
      tenant_id: barber.tenant_id,
      display_name: barber.display_name,
      slug: existingSlug,
    });
    bookingUrl = publicBookingUrl(tenantSlug, barberSlug, appUrl);
  }

  const showSetupChecklist = actsAsBarber && !anyBookingRes.data?.length;
  let pendingAccessQuery = supabaseAdmin
    .from("barber_client_access")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "pending");

  if (role === "barber") {
    pendingAccessQuery = pendingAccessQuery.eq("barber_id", barber.id);
  }

  const { count: pendingAccessCount } = await pendingAccessQuery;

  return (
    <div className="space-y-8 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold">
          Salut, {barber.display_name} 👋
        </h1>
        <p className="text-frz-ink/60 mt-1">Panoul tău de control</p>
      </div>

      {actsAsBarber && (
        <SetupChecklist
          barberId={barber.id}
          createdAt={
            typeof barber.created_at === "string" ? barber.created_at : null
          }
          eligible={showSetupChecklist}
        />
      )}

      {(pendingAccessCount ?? 0) > 0 && (
        <AdminCard className="border-amber-400/40 bg-amber-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Solicitări noi de acces</h2>
              <p className="mt-1 text-sm text-frz-muted">
                Ai {pendingAccessCount} {pendingAccessCount === 1 ? "solicitare în așteptare" : "solicitări în așteptare"}.
              </p>
            </div>
            <AdminButton href="/admin/client-access" size="sm">
              Verifică solicitările
            </AdminButton>
          </div>
        </AdminCard>
      )}

      <BookingLinkCard
        initialUrl={bookingUrl}
        barberId={actsAsBarber ? barber.id : undefined}
        title={bookingLinkLabel}
      />

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

            <AdminButton variant="secondary" size="sm" href="/admin/reports">
              Rapoarte
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {currentPlan?.status === "trialing" &&
        currentPlan?.trial_ends_at &&
        (() => {
          // eslint-disable-next-line react-hooks/purity -- intentional per-request clock
          const nowMs = Date.now();
          const daysLeft = Math.max(
            0,
            Math.ceil(
              (new Date(currentPlan.trial_ends_at).getTime() - nowMs) /
                (1000 * 60 * 60 * 24),
            ),
          );

          return (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
              <div className="font-semibold text-blue-300">🎁 Trial activ</div>

              <p className="text-frz-ink/70 mt-2">
                {currentPlan?.slug === "pro"
                  ? "Beneficiezi de acces Pro (SMS reminder, 1 frizer, programări nelimitate — fără invitații echipă)."
                  : "Beneficiezi de acces Pro+ (SMS reminder, până la 3 frizeri, programări nelimitate)."}
              </p>

              <p className="text-frz-ink mt-3 font-medium">
                Mai ai {daysLeft} zile rămase.
              </p>

              <p className="text-frz-ink/50 text-sm mt-2">
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
          <p className="text-sm text-frz-ink/60">
            {actsAsBarber ? "Programări azi" : "Programări salon azi"}
          </p>
          <p className="text-3xl font-bold mt-2">
            {todayBookings?.length || 0}
          </p>
        </AdminCard>

        <AdminCard padding="sm">
          <p className="text-sm text-frz-ink/60">Status</p>
          <p className="text-lg mt-2">
            {todayBookings && todayBookings.length > 0
              ? "Ai clienți azi"
              : "Zi liberă"}
          </p>
        </AdminCard>

        <AdminCard padding="sm">
          <p className="text-sm text-frz-ink/60">Următoarea programare</p>
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

          <AdminButton size="sm" href="/admin/reports">
            Rapoarte
          </AdminButton>

          {actsAsBarber ? (
            <>
              <AdminButton size="sm" href="/admin/services">
                Servicii
              </AdminButton>

              <AdminButton size="sm" href="/admin/settings">
                Program
              </AdminButton>
            </>
          ) : (
            <AdminButton size="sm" href="/admin/barbers">
              Frizeri / rol
            </AdminButton>
          )}
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="text-lg font-semibold mb-4">Programările de azi</h2>

        {!todayBookings || todayBookings.length === 0 ? (
          <p className="text-frz-ink/60">Nu ai programări azi.</p>
        ) : (
          <div className="space-y-3">
            {todayBookings.map((b) => (
              <div
                key={b.id}
                className="flex justify-between items-center p-3 rounded-lg bg-frz-fog"
              >
                <div>
                  <p className="font-medium">{b.client_name}</p>
                  <p className="text-sm text-frz-ink/60">
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
          <p className="text-frz-ink/60">Nu există programări.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <div
                key={b.id}
                className="flex justify-between items-center p-3 rounded-lg bg-frz-fog"
              >
                <div>
                  <p className="font-medium">{b.client_name}</p>
                  <p className="text-sm text-frz-ink/60">
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

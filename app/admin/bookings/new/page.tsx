import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AddBookingClient from "./AddBookingClient";
import AdminButton from "../../components/AdminButton";
import EmptyState from "../../components/EmptyState";

export default async function Page() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/admin");
  }

  const role = await getCurrentRole();

  let barbers: Array<{ id: string; display_name: string; active: boolean }> =
    [];

  if (role === "owner") {
    const { data } = await supabaseAdmin
      .from("barbers")
      .select("id, display_name, active")
      .eq("tenant_id", barber.tenant_id)
      .eq("active", true)
      .order("display_name");

    barbers = data || [];
  } else if (!barber.active) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Adaugă programare</h1>
        <EmptyState>
          Contul tău de frizer este inactiv. Nu poți crea programări noi.
        </EmptyState>
        <AdminButton href="/admin/bookings" variant="secondary">
          Înapoi la programări
        </AdminButton>
      </div>
    );
  }

  if (role === "owner" && barbers.length === 0) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Adaugă programare</h1>
        <EmptyState>
          Nu există frizeri activi. Activează un frizer din secțiunea Frizeri.
        </EmptyState>
        <AdminButton href="/admin/barbers" variant="secondary">
          Mergi la Frizeri
        </AdminButton>
      </div>
    );
  }

  const defaultBarberId =
    role === "owner"
      ? barbers.find((b) => b.id === barber.id)?.id ?? barbers[0]?.id
      : barber.id;

  const { data: services } = await supabaseAdmin
    .from("barber_services")
    .select("*")
    .eq("barber_id", defaultBarberId)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  return (
    <AddBookingClient
      defaultBarberId={defaultBarberId}
      initialServices={services || []}
      role={role}
      barbers={barbers}
    />
  );
}

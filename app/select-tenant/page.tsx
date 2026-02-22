import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SelectTenantPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: barbers } = await supabase
    .from("barbers")
    .select("tenant_id, tenants(name)")
    .eq("user_id", user.id)
    .eq("active", true);

  if (!barbers || barbers.length === 0) {
    return <p>Nu ești asociat niciunui salon.</p>;
  }

  if (barbers.length === 1) {
    redirect(`/api/select-tenant?tenantId=${barbers[0].tenant_id}`);
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Alege salonul</h1>
      <ul>
        {barbers.map((b) => (
          <li key={b.tenant_id}>
            <a href={`/api/select-tenant?tenantId=${b.tenant_id}`}>
              {b.tenants?.[0]?.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

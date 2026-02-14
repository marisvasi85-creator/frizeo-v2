import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminServicesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 🔹 tenant activ
  const { data: activeTenant } = await supabase
    .from("user_active_tenant")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!activeTenant) {
    return <p>Nu ai un salon activ.</p>;
  }

  const { data: services, error } = await supabase
    .from("barber_services")
    .select(`
      id,
      display_name,
      duration,
      price,
      sort_order,
      show_price,
      featured,
      active
    `)
    .eq("tenant_id", activeTenant.tenant_id)
    .order("sort_order", { ascending: true });

  if (error) {
    return <p>Eroare: {error.message}</p>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Servicii</h1>

      <table
        border={1}
        cellPadding={8}
        style={{ marginTop: 16, width: "100%" }}
      >
        <thead>
          <tr>
            <th>Nume</th>
            <th>Durată</th>
            <th>Preț</th>
            <th>Ordine</th>
            <th>Preț vizibil</th>
            <th>⭐ Recomandat</th>
            <th>Activ</th>
          </tr>
        </thead>

        <tbody>
          {services?.map((s) => (
            <tr key={s.id}>
              <td>{s.display_name}</td>
              <td>{s.duration} min</td>
              <td>{s.price ?? "-"}</td>

              <td>
                <input
                  type="number"
                  defaultValue={s.sort_order ?? 0}
                  onBlur={async (e) => {
                    await supabase
                      .from("barber_services")
                      .update({
                        sort_order: Number(e.target.value),
                      })
                      .eq("id", s.id);
                  }}
                  style={{ width: 60 }}
                />
              </td>

              <td>
                <input
                  type="checkbox"
                  defaultChecked={s.show_price}
                  onChange={async (e) => {
                    await supabase
                      .from("barber_services")
                      .update({
                        show_price: e.target.checked,
                      })
                      .eq("id", s.id);
                  }}
                />
              </td>

              <td>
                <input
                  type="checkbox"
                  defaultChecked={s.featured}
                  onChange={async (e) => {
                    await supabase
                      .from("barber_services")
                      .update({
                        featured: e.target.checked,
                      })
                      .eq("id", s.id);
                  }}
                />
              </td>

              <td>
                <input
                  type="checkbox"
                  defaultChecked={s.active}
                  onChange={async (e) => {
                    await supabase
                      .from("barber_services")
                      .update({
                        active: e.target.checked,
                      })
                      .eq("id", s.id);
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

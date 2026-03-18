import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { getUserRoleInTenant } from "@/lib/auth/getUserRoleInTenant";
import { createService, deleteService } from "./actions";

export default async function ServicesPage() {
  const supabase = await createSupabaseServerClient();

  const tenant = await getActiveTenant();
  const role = await getUserRoleInTenant();

  if (!tenant?.tenant_id || !role) {
    redirect("/select-tenant");
  }

  if (role !== "owner" && role !== "manager") {
    redirect("/admin/dashboard");
  }

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("tenant_id", tenant.tenant_id)
    .order("name");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Services</h1>

      {/* Add Service */}
      <form action={createService} className="space-y-4 bg-white p-6 rounded shadow">
        <div>
          <input
            name="name"
            placeholder="Service name"
            required
            className="border p-2 rounded w-full"
          />
        </div>

        <div>
          <input
            name="duration"
            type="number"
            placeholder="Duration (minutes)"
            required
            className="border p-2 rounded w-full"
          />
        </div>

        <div>
          <input
            name="price"
            type="number"
            placeholder="Price"
            required
            className="border p-2 rounded w-full"
          />
        </div>

        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
          Add Service
        </button>
      </form>

      {/* Services List */}
      <div className="space-y-4">
        {(!services || services.length === 0) && (
          <p>No services yet.</p>
        )}

        {services?.map((service) => (
          <div
            key={service.id}
            className="flex justify-between items-center bg-white p-4 rounded shadow"
          >
            <div>
              <div className="font-semibold">{service.name}</div>
              <div className="text-sm text-gray-500">
                {service.duration} min – {service.price} RON
              </div>
            </div>

            <form
              action={async () => {
                "use server";
                await deleteService(service.id);
              }}
            >
              <button className="text-red-500 hover:text-red-700 text-sm">
                Delete
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
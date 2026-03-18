import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { getUserRoleInTenant } from "@/lib/auth/getUserRoleInTenant";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  // 🔒 IMPORTANT: folosim getUser, NU getSession
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const tenant = await getActiveTenant();
console.log("TENANT:", tenant);
  if (!tenant?.tenant_id) {
    redirect("/select-tenant");
  }

  const role = await getUserRoleInTenant();
console.log("ROLE:", role);
  if (!role) {
    redirect("/select-tenant");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-900 text-white p-6 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-8 tracking-wide">
            {tenant.name ?? "Frizeo"}
          </h2>

          <nav className="flex flex-col gap-4 text-sm">
            <Link
              className="hover:text-blue-400 transition"
              href="/admin/dashboard"
            >
              Dashboard
            </Link>

            <Link
              className="hover:text-blue-400 transition"
              href="/admin/calendar"
            >
              Calendar
            </Link>

            <Link
              className="hover:text-blue-400 transition"
              href="/admin/bookings"
            >
              Bookings
            </Link>

            {(role === "owner" || role === "manager") && (
              <Link
                className="hover:text-blue-400 transition"
                href="/admin/services"
              >
                Services
              </Link>
            )}

            {role === "owner" && (
              <Link
                className="hover:text-blue-400 transition"
                href="/admin/settings"
              >
                Settings
              </Link>
            )}
          </nav>
        </div>

        <form action="/api/logout" method="post">
          <button className="text-sm text-red-400 hover:text-red-300 transition">
            Logout
          </button>
        </form>
      </aside>

      <main className="flex-1 p-10 bg-gray-100">{children}</main>
    </div>
  );
}
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { redirect } from "next/navigation";
import { sessionActsAsBarber } from "../components/adminNav";

/**
 * Barber workstation pages (Profil, Servicii, Program) require an active
 * barber profile. Admin-only owners are sent to Frizeri to enable the role.
 */
export async function requireActsAsBarber() {
  const session = await getAdminSession();
  if (!session?.user) {
    redirect("/login");
  }

  if (!session.barber) {
    redirect("/login");
  }

  if (!sessionActsAsBarber(session)) {
    redirect("/admin/barbers?role=admin-only");
  }

  return session;
}

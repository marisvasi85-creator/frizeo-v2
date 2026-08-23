import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import ClientAccessClient from "./ClientAccessClient";

export default async function ClientAccessPage() {
  const session = await getAdminSession();

  if (!session?.tenantId) {
    redirect("/login");
  }

  if (!session.role || !["owner", "manager", "barber"].includes(session.role)) {
    redirect("/admin/dashboard");
  }

  return <ClientAccessClient />;
}

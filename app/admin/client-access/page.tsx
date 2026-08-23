import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import ClientAccessClient from "./ClientAccessClient";

export default async function ClientAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ barberId?: string; status?: string }>;
}) {
  const session = await getAdminSession();
  const query = await searchParams;

  if (!session?.tenantId) {
    redirect("/login");
  }

  if (!session.role || !["owner", "manager", "barber"].includes(session.role)) {
    redirect("/admin/dashboard");
  }

  return (
    <ClientAccessClient
      initialBarberId={query.barberId ?? ""}
      initialStatus={query.status ?? "all"}
    />
  );
}

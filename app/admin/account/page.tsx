import AdminPageHeader from "../components/AdminPageHeader";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { getActiveDeletionRequest } from "@/lib/account-deletion/createRequest";
import { redirect } from "next/navigation";
import AccountDeletionClient from "./AccountDeletionClient";

export default async function AccountPage() {
  const session = await getAdminSession();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const active = await getActiveDeletionRequest(session.user.id);

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader
        title="Cont"
        subtitle="Setări de cont și ștergere. Acțiunile de aici afectează utilizatorul autentificat, nu tot salonul."
      />
      <AccountDeletionClient
        email={session.user.email}
        activeRequest={
          active
            ? {
                id: active.id,
                status: active.status,
                scheduled_for: active.scheduled_for,
                requested_at: active.requested_at,
              }
            : null
        }
      />
    </div>
  );
}

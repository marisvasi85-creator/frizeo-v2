import { headers } from "next/headers";
import AdminPageHeader from "../components/AdminPageHeader";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { getActiveDeletionRequest } from "@/lib/account-deletion/createRequest";
import { ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE } from "@/lib/account-deletion/decisions";
import { loadOwnershipTransferBlocks } from "@/lib/account-deletion/ownership";
import { accountDeletionWritesAreAllowed } from "@/lib/account-deletion/runtimeGuard";
import { hostnameFromHeaderStore } from "@/lib/app/environment";
import { shouldUseStagingSupabase } from "@/lib/supabase/config";
import { redirect } from "next/navigation";
import AccountDeletionClient from "./AccountDeletionClient";

export default async function AccountPage() {
  const session = await getAdminSession();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const hostname = hostnameFromHeaderStore(await headers());
  const writesAllowed = accountDeletionWritesAreAllowed(hostname);
  const [active, ownershipBlocks] = await Promise.all([
    getActiveDeletionRequest(session.user.id),
    loadOwnershipTransferBlocks(session.user.id),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader
        title="Cont"
        subtitle="Setări de cont și ștergere. Acțiunile de aici afectează utilizatorul autentificat, nu tot salonul."
      />
      <AccountDeletionClient
        email={session.user.email}
        writesAllowed={writesAllowed}
        allowImmediateFinalize={shouldUseStagingSupabase(hostname)}
        unavailableMessage={
          writesAllowed ? null : ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE
        }
        activeRequest={
          active
            ? {
                id: active.id,
                status: active.status,
                scheduled_for: active.scheduled_for,
                requested_at: active.requested_at,
                failure_reason: active.failure_reason,
              }
            : null
        }
        ownershipBlocks={ownershipBlocks}
      />
    </div>
  );
}

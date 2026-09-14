import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ACCOUNT_DELETION_SELECT } from "@/lib/account-deletion/types";
import {
  isDevelopment,
  isPreview,
  isProduction,
  isStaging,
} from "@/lib/app/environment";
import { simulateExpiryAllowed } from "@/lib/account-deletion/decisions";
import AdminPageHeader from "../components/AdminPageHeader";
import AccountDeletionsClient from "./AccountDeletionsClient";

export default async function AccountDeletionsPage() {
  const user = await getAuthUser();
  if (!user || !isPlatformCreatorEmail(user.email)) {
    redirect("/admin/dashboard");
  }

  const { data, error } = await supabaseAdmin
    .from("account_deletion_requests")
    .select(`${ACCOUNT_DELETION_SELECT}, tenants(name, slug)`)
    .order("requested_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("account deletions page", error);
  }

  const requests = (data ?? []).map((row) => {
    const tenant = row.tenants as { name?: string; slug?: string } | null;
    return {
      id: row.id,
      user_id: row.user_id,
      tenant_id: row.tenant_id,
      tenant_name: tenant?.name ?? null,
      tenant_slug: tenant?.slug ?? null,
      email_snapshot: row.email_snapshot,
      reason: row.reason,
      reason_details: row.reason_details,
      status: row.status,
      requested_at: row.requested_at,
      scheduled_for: row.scheduled_for,
      cancelled_at: row.cancelled_at,
      completed_at: row.completed_at,
      failure_reason: row.failure_reason,
    };
  });

  return (
    <div className="space-y-6 min-w-0">
      <div className="inline-flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full">
        Creator only · user deletion, never whole salon
      </div>
      <AdminPageHeader
        title="Account deletion requests"
        subtitle="Solicitări de ștergere cont. Delete now folosește exact worker-ul de finalizare. Nu șterge un tenant."
      />
      <AccountDeletionsClient
        initialRequests={requests}
        simulateExpiryEnabled={simulateExpiryAllowed({
          isProduction: isProduction(),
          isStaging: isStaging(),
          isDevelopment: isDevelopment(),
          isPreview: isPreview(),
        })}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import AdminButton from "@/app/admin/components/AdminButton";
import AdminCard from "@/app/admin/components/AdminCard";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import {
  resolveCapabilities,
  type CapabilityMap,
} from "@/lib/integrations/capabilities";
import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import { presentConnection } from "@/lib/integrations/presentation";
import { safeErrorText } from "@/lib/integrations/redaction";
import {
  INTEGRATION_PROVIDERS,
  PROVIDER_LABELS,
  isIntegrationProvider,
  type ConnectionStatus,
  type IntegrationProvider,
  type PublicConnection,
} from "@/lib/integrations/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CONNECTION_COLUMNS =
  "id, provider, display_name, status, scopes, connected_at, token_expires_at, last_validated_at, last_error";

export default async function IntegrationSettingsPage() {
  const session = await getAdminSession();
  if (!session?.user) redirect("/login");
  if (!session.tenantId || !canAdministerIntegrations(session.role)) {
    redirect("/admin/dashboard");
  }

  const connections = await loadConnections(session.tenantId);
  const capabilities = await loadCapabilities(session.tenantId);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Integrări"
        subtitle="Conexiunile externe sunt oprite implicit. OAuth-ul real nu este disponibil în acest pas."
      />

      <div className="grid gap-4">
        {INTEGRATION_PROVIDERS.map((provider) => {
          const connection = connections.find((row) => row.provider === provider) ?? null;
          const view = presentConnection(connection?.status ?? null);
          const publishCapability =
            provider === "meta"
              ? capabilities["marketing.publish.meta"]
              : provider === "google_business"
                ? capabilities["marketing.publish.google_business"]
                : provider === "tiktok"
                  ? capabilities["marketing.publish.tiktok"]
                  : capabilities["marketing.publish.whatsapp"];

          return (
            <AdminCard key={provider}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-frz-ink">
                    {PROVIDER_LABELS[provider]}
                  </h2>
                  <p className="mt-1 text-sm text-frz-muted">
                    Status: {view.label}
                    {view.comingSoon ? " · În curând" : ""}
                  </p>
                  <p className="mt-1 text-sm text-frz-muted">
                    Publicare: {publishCapability ? "activă" : "oprită"}
                  </p>
                  {connection?.displayName && (
                    <p className="mt-2 text-sm text-frz-ink">{connection.displayName}</p>
                  )}
                  {connection?.lastError && (
                    <p className="mt-2 text-sm text-red-700">
                      {safeErrorText(connection.lastError)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminButton type="button" variant="secondary" disabled>
                    Conectează
                  </AdminButton>
                  <AdminButton type="button" variant="ghost" disabled>
                    Reconectează
                  </AdminButton>
                  <AdminButton type="button" variant="ghost" disabled>
                    Deconectează
                  </AdminButton>
                </div>
              </div>
            </AdminCard>
          );
        })}
      </div>
    </div>
  );
}

async function loadCapabilities(tenantId: string): Promise<CapabilityMap> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_capabilities")
    .select("capability, enabled")
    .eq("tenant_id", tenantId);
  if (error || !data) return resolveCapabilities([]);
  return resolveCapabilities(data);
}

async function loadConnections(tenantId: string): Promise<PublicConnection[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("marketing_connections")
    .select(CONNECTION_COLUMNS)
    .eq("tenant_id", tenantId);

  if (error || !data) return [];

  return data.flatMap((row) => {
    if (!isIntegrationProvider(row.provider)) return [];
    const connection: PublicConnection = {
      id: row.id,
      provider: row.provider as IntegrationProvider,
      displayName: row.display_name,
      status: row.status as ConnectionStatus,
      scopes: row.scopes ?? [],
      connectedAt: row.connected_at,
      tokenExpiresAt: row.token_expires_at,
      lastValidatedAt: row.last_validated_at,
      lastError: row.last_error,
    };
    return [connection];
  });
}

import { redirect } from "next/navigation";
import AdminButton from "@/app/admin/components/AdminButton";
import AdminCard from "@/app/admin/components/AdminCard";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import MetaDestinationPicker from "@/app/admin/settings/integrations/MetaDestinationPicker";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { isProduction } from "@/lib/app/environment";
import {
  resolveCapabilities,
  type CapabilityMap,
} from "@/lib/integrations/capabilities";
import { assertMetaConfig } from "@/lib/integrations/meta/config";
import {
  decideMetaConnect,
  effectiveMetaStatus,
  presentMetaDestination,
  type MetaNotice,
} from "@/lib/integrations/meta/flow";
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

const NOTICES: Record<MetaNotice, string> = {
  select: "Autorizarea a reușit. Alege paginile și conturile Instagram înainte ca integrarea să fie marcată conectată.",
  denied: "Autorizarea Meta a fost refuzată. Nu s-a creat o conexiune.",
  expired: "Sesiunea de conectare a expirat.",
  consumed: "Sesiunea de conectare a fost deja folosită.",
  mismatch: "Conectarea nu corespunde utilizatorului sau salonului curent.",
  exchange_failed: "Meta nu a confirmat tokenul. Conexiunea nu este funcțională.",
  permissions: "Lipsesc permisiuni obligatorii. Integrarea nu este funcțională.",
  unconfigured: "Meta nu este configurat pe server.",
  timeout: "Meta nu a răspuns la timp.",
  capability: "Integrarea Meta este oprită pentru acest salon.",
  production: "Integrarea Meta nu este activă în producție.",
  forbidden: "Doar owner sau manager pot administra conexiunea.",
  disconnected_remote: "Accesul local a fost eliminat și Meta a confirmat revocarea.",
  disconnected_local_only: "Accesul local a fost eliminat. Revocarea la Meta nu a fost confirmată.",
  saved: "Destinațiile Meta au fost salvate.",
  no_pages: "Nu există pagini Facebook disponibile pentru acest cont.",
  invalid: "Conectarea Meta nu a putut fi finalizată.",
};

const STATUS_LABEL: Record<string, string> = {
  not_connected: "Neconectat",
  connected: "Conectat",
  needs_reconnect: "Necesită reconectare",
  error: "Eroare",
  setup_required: "Alege destinațiile",
};

export default async function IntegrationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string; meta_error?: string }>;
}) {
  const session = await getAdminSession();
  if (!session?.user) redirect("/login");
  if (!session.tenantId || !canAdministerIntegrations(session.role)) {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const notice = noticeFrom(params.meta) ?? noticeFrom(params.meta_error);
  const [connections, capabilities, destinations] = await Promise.all([
    loadConnections(session.tenantId),
    loadCapabilities(session.tenantId),
    loadDestinations(session.tenantId),
  ]);
  const production = isProduction();
  const configured = assertMetaConfig(process.env, { production }).ok;
  const metaConnection = connections.find((row) => row.provider === "meta") ?? null;
  const metaStatus = effectiveMetaStatus(
    metaConnection?.status ?? null,
    metaConnection?.tokenExpiresAt ?? null,
  );
  const metaGate = decideMetaConnect({
    authenticated: true,
    role: session.role,
    capabilityEnabled: capabilities["marketing.publish.meta"],
    configured,
    production,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Integrări"
        subtitle="Facebook și Instagram pot fi conectate pe staging doar când capability-ul salonului este pornit. Publicarea nu este disponibilă."
      />
      {notice && (
        <p className="rounded-xl border border-frz-line bg-frz-card px-4 py-3 text-sm text-frz-ink">
          {NOTICES[notice]}
        </p>
      )}

      <AdminCard>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-frz-ink">Facebook & Instagram</h2>
            <p className="mt-1 text-sm text-frz-muted">Status: {STATUS_LABEL[metaStatus]}</p>
            <p className="mt-1 text-sm text-frz-muted">
              Publicare: {capabilities["marketing.publish.meta"] ? "activă" : "oprită"}
            </p>
            {metaConnection?.displayName && (
              <p className="mt-2 text-sm text-frz-ink">Cont conectat: {metaConnection.displayName}</p>
            )}
            {metaConnection && metaConnection.scopes.length > 0 && (
              <p className="mt-1 text-sm text-frz-muted">
                Permisiuni acordate: {metaConnection.scopes.join(", ")}
              </p>
            )}
            {metaConnection?.lastError && (
              <p className="mt-2 text-sm text-red-700">{safeErrorText(metaConnection.lastError)}</p>
            )}
          </div>
          {destinations.length > 0 && (
            <ul className="space-y-2 text-sm">
              {destinations.map((destination) => {
                const view = presentMetaDestination(destination);
                return (
                  <li key={`${destination.destinationType}:${destination.id}`} className="text-frz-ink">
                    <span className="font-medium">{view.title}</span>
                    {view.detail && <span className="mt-1 block text-frz-muted">{view.detail}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {metaGate.ok && metaStatus !== "connected" && (
              <form action="/api/integrations/meta/connect" method="post">
                <AdminButton type="submit">
                  {metaConnection ? "Reconectează" : "Conectează Facebook & Instagram"}
                </AdminButton>
              </form>
            )}
            {metaGate.ok && metaStatus === "connected" && (
              <form action="/api/integrations/meta/connect" method="post">
                <AdminButton type="submit" variant="secondary">Reconectează</AdminButton>
              </form>
            )}
            {metaConnection && (
              <form action="/api/integrations/meta/disconnect" method="post">
                <AdminButton type="submit" variant="ghost">Deconectează</AdminButton>
              </form>
            )}
          </div>
          {!metaGate.ok && (
            <p className="text-sm text-frz-muted">{NOTICES[noticeForGate(metaGate.reason)]}</p>
          )}
          {metaGate.ok && (metaStatus === "setup_required" || metaStatus === "connected" || metaStatus === "error") && (
            <MetaDestinationPicker />
          )}
        </div>
      </AdminCard>

      <div className="grid gap-4">
        {INTEGRATION_PROVIDERS.filter((provider) => provider !== "meta").map((provider) => {
          const connection = connections.find((row) => row.provider === provider) ?? null;
          const view = presentConnection(connection?.status ?? null);
          const publishCapability = publishFlag(provider, capabilities);
          return (
            <AdminCard key={provider}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-frz-ink">{PROVIDER_LABELS[provider]}</h2>
                  <p className="mt-1 text-sm text-frz-muted">
                    Status: {view.label}
                    {view.comingSoon ? " · În curând" : ""}
                  </p>
                  <p className="mt-1 text-sm text-frz-muted">
                    Publicare: {publishCapability ? "activă" : "oprită"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminButton type="button" variant="secondary" disabled>Conectează</AdminButton>
                  <AdminButton type="button" variant="ghost" disabled>Reconectează</AdminButton>
                  <AdminButton type="button" variant="ghost" disabled>Deconectează</AdminButton>
                </div>
              </div>
            </AdminCard>
          );
        })}
      </div>
    </div>
  );
}

function noticeForGate(reason: "forbidden" | "capability_off" | "unconfigured" | "production" | "unauthenticated"): MetaNotice {
  if (reason === "capability_off") return "capability";
  if (reason === "production") return "production";
  if (reason === "forbidden") return "forbidden";
  return "unconfigured";
}

function noticeFrom(value: string | undefined): MetaNotice | null {
  if (!value || !(value in NOTICES)) return null;
  return value as MetaNotice;
}

function publishFlag(provider: IntegrationProvider, capabilities: CapabilityMap): boolean {
  if (provider === "google_business") return capabilities["marketing.publish.google_business"];
  if (provider === "tiktok") return capabilities["marketing.publish.tiktok"];
  if (provider === "whatsapp") return capabilities["marketing.publish.whatsapp"];
  return capabilities["marketing.publish.meta"];
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

async function loadDestinations(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("marketing_destinations")
    .select("destination_type, provider_destination_id, display_name, metadata")
    .eq("tenant_id", tenantId)
    .eq("provider", "meta");
  if (error || !data) return [];
  return data.map((row) => ({
    destinationType: row.destination_type,
    id: row.provider_destination_id,
    displayName: row.display_name,
    metadata: row.metadata,
  }));
}

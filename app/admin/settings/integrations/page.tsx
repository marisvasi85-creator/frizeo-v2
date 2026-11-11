import { redirect } from "next/navigation";
import AdminButton from "@/app/admin/components/AdminButton";
import AdminCard from "@/app/admin/components/AdminCard";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import GoogleDestinationPicker from "@/app/admin/settings/integrations/GoogleDestinationPicker";
import MetaDestinationPicker from "@/app/admin/settings/integrations/MetaDestinationPicker";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { isProduction } from "@/lib/app/environment";
import {
  resolveCapabilities,
  type CapabilityMap,
} from "@/lib/integrations/capabilities";
import { assertGoogleBusinessConfig } from "@/lib/integrations/google-business/config";
import {
  decideGoogleConnect,
  type GoogleNotice,
} from "@/lib/integrations/google-business/flow";
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
  unknown_expiry: "Meta nu a comunicat o dată de expirare a tokenului. Conexiunea nu a fost salvată. Reconectarea se face manual.",
  token_expired: "Tokenul Meta este expirat. Reconectează manual.",
};

const GOOGLE_NOTICES: Record<GoogleNotice, string> = {
  select: "Autorizarea Google a reușit. Alege locațiile Business Profile înainte ca integrarea să fie marcată conectată.",
  denied: "Autorizarea Google a fost refuzată. Nu s-a creat o conexiune.",
  expired: "Sesiunea de conectare a expirat.",
  consumed: "Sesiunea de conectare a fost deja folosită.",
  mismatch: "Conectarea nu corespunde utilizatorului sau salonului curent.",
  exchange_failed: "Google nu a confirmat tokenul. Conexiunea nu a fost salvată.",
  permissions: "Lipsește scope-ul business.manage. Conexiunea nu a fost salvată.",
  unconfigured: "Google Business nu este configurat pe server.",
  timeout: "Google nu a răspuns la timp. Nu s-a salvat nicio locație.",
  capability: "Integrarea Google Business este oprită pentru acest salon.",
  production: "Integrarea Google Business nu este activă în producție.",
  forbidden: "Doar owner sau manager pot administra conexiunea.",
  disconnected: "Accesul local Google Business a fost eliminat.",
  saved: "Locațiile Google Business au fost salvate.",
  no_locations: "Google nu a întors niciun cont Business Profile. Nu s-a inventat o locație.",
  accounts_forbidden: "Google a refuzat listarea conturilor Business Profile. Conexiunea nu a fost salvată.",
  rate_limited: "Google a limitat temporar cererile către Business Profile. Conexiunea nu a fost salvată.",
  api_disabled: "API-ul Google pentru conturile Business Profile este dezactivat. Conexiunea nu a fost salvată.",
  access_not_approved: "Accesul proiectului Google la Business Profile nu este aprobat. Conexiunea nu a fost salvată.",
  accounts_network: "Google Business nu a putut fi contactat. Conexiunea nu a fost salvată.",
  accounts_unavailable: "Google nu a putut lista conturile Business Profile. Conexiunea nu a fost salvată.",
  invalid: "Conectarea Google Business nu a putut fi finalizată.",
  unknown_expiry: "Google nu a comunicat expirarea tokenului. Conexiunea nu a fost salvată.",
  calendar_scope: "Tokenul include Google Calendar. Conexiunea Business Profile nu a fost salvată.",
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
  searchParams: Promise<{ meta?: string; meta_error?: string; google?: string; google_error?: string }>;
}) {
  const session = await getAdminSession();
  if (!session?.user) redirect("/login");
  if (!session.tenantId || !canAdministerIntegrations(session.role)) {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const notice = noticeFrom(params.meta) ?? noticeFrom(params.meta_error);
  const googleNotice = googleNoticeFrom(params.google) ?? googleNoticeFrom(params.google_error);
  const [connections, capabilities, destinations, googleDestinations] = await Promise.all([
    loadConnections(session.tenantId),
    loadCapabilities(session.tenantId),
    loadDestinations(session.tenantId),
    loadGoogleDestinations(session.tenantId),
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
  const googleConnection = connections.find((row) => row.provider === "google_business") ?? null;
  const googleConfigured = assertGoogleBusinessConfig(process.env, { production }).ok;
  const googleGate = decideGoogleConnect({
    authenticated: true,
    role: session.role,
    capabilityEnabled: capabilities["marketing.publish.google_business"],
    configured: googleConfigured,
    production,
  });
  const googleStatus = googleConnection?.status ?? "not_connected";

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
      {googleNotice && (
        <p className="rounded-xl border border-frz-line bg-frz-card px-4 py-3 text-sm text-frz-ink">
          {GOOGLE_NOTICES[googleNotice]}
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

      <AdminCard>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-frz-ink">Google Business Profile</h2>
            <p className="mt-1 text-sm text-frz-muted">Status: {STATUS_LABEL[googleStatus] ?? googleStatus}</p>
            <p className="mt-1 text-sm text-frz-muted">
              Publicare: {capabilities["marketing.publish.google_business"] ? "activă" : "oprită"}
            </p>
            {googleConnection?.displayName && (
              <p className="mt-2 text-sm text-frz-ink">Cont conectat: {googleConnection.displayName}</p>
            )}
            {googleConnection && googleConnection.scopes.length > 0 && (
              <p className="mt-1 text-sm text-frz-muted">
                Permisiuni acordate: {googleConnection.scopes.join(", ")}
              </p>
            )}
          </div>
          {googleDestinations.length > 0 && (
            <ul className="space-y-2 text-sm">
              {googleDestinations.map((destination) => (
                <li key={destination.id} className="text-frz-ink">{destination.displayName}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {googleGate.ok && (
              <form action="/api/integrations/google-business/connect" method="post">
                <AdminButton type="submit" variant={googleConnection ? "secondary" : "primary"}>
                  {googleConnection ? "Reconectează" : "Conectează Google Business"}
                </AdminButton>
              </form>
            )}
            {googleConnection && (
              <form action="/api/integrations/google-business/disconnect" method="post">
                <AdminButton type="submit" variant="ghost">Deconectează</AdminButton>
              </form>
            )}
            {!googleGate.ok && !googleConnection && (
              <>
                <AdminButton type="button" variant="secondary" disabled>Conectează</AdminButton>
                <AdminButton type="button" variant="ghost" disabled>Reconectează</AdminButton>
                <AdminButton type="button" variant="ghost" disabled>Deconectează</AdminButton>
              </>
            )}
          </div>
          {!googleGate.ok && (
            <p className="text-sm text-frz-muted">
              {GOOGLE_NOTICES[googleGate.reason === "capability_off" ? "capability" : googleGate.reason === "production" ? "production" : googleGate.reason === "forbidden" ? "forbidden" : "unconfigured"]}
              {" "}Publicarea reală rămâne oprită.
            </p>
          )}
          {googleGate.ok && (googleStatus === "setup_required" || googleStatus === "connected") && (
            <GoogleDestinationPicker />
          )}
        </div>
      </AdminCard>

      <div className="grid gap-4">
        {INTEGRATION_PROVIDERS.filter((provider) => provider !== "meta" && provider !== "google_business").map((provider) => {
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

function googleNoticeFrom(value: string | undefined): GoogleNotice | null {
  if (!value || !(value in GOOGLE_NOTICES)) return null;
  return value as GoogleNotice;
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

async function loadGoogleDestinations(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("marketing_destinations")
    .select("provider_destination_id, display_name")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_business")
    .eq("destination_type", "google_business_location")
    .eq("status", "active");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.provider_destination_id,
    displayName: row.display_name,
  }));
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

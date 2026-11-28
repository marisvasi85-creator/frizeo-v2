import { redirect } from "next/navigation";
import AdminCard from "@/app/admin/components/AdminCard";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import PublishComposer from "@/app/admin/marketing/publish/PublishComposer";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { isProduction } from "@/lib/app/environment";
import { googleBusinessLiveEnvEnabled } from "@/lib/integrations/google-business/config";
import { resolveCapabilities } from "@/lib/integrations/capabilities";
import { metaPublishLiveEnvEnabled } from "@/lib/integrations/meta/publish/flags";
import { currentStagingMetaOwnerAccess } from "@/lib/integrations/meta/tenantAccess";
import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MarketingPublishPage() {
  const session = await getAdminSession();
  if (!session?.user) redirect("/login");
  if (!session.tenantId || !canAdministerIntegrations(session.role)) {
    redirect("/admin/dashboard");
  }
  const supabase = await createSupabaseServerClient();
  const [{ data: capabilities }, { data: destinations }, { data: jobs }] = await Promise.all([
    supabase
      .from("tenant_capabilities")
      .select("capability, enabled")
      .eq("tenant_id", session.tenantId)
      .in("capability", [
        "marketing.publish.meta",
        "marketing.publish.meta.live",
        "marketing.publish.google_business",
        "marketing.publish.google_business.live",
      ]),
    supabase
      .from("marketing_destinations")
      .select("id, destination_type, display_name, status")
      .eq("tenant_id", session.tenantId)
      .in("provider", ["meta", "google_business"])
      .eq("status", "active"),
    supabase
      .from("integration_publish_jobs")
      .select("id, asset_id, destination_id, status, execution_mode, safe_error, provider_container_id, provider_post_id, marketing_destinations(display_name, destination_type), integration_assets(body)")
      .eq("tenant_id", session.tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const metaResolved = resolveCapabilities(capabilities ?? [], {
    stagingMetaOwnerAccess: capabilities
      ? currentStagingMetaOwnerAccess()
      : false,
  });
  const integrationEnabled = metaResolved["marketing.publish.meta"];
  const liveCapability = metaResolved["marketing.publish.meta.live"];
  const liveAvailable = integrationEnabled && liveCapability && metaPublishLiveEnvEnabled();
  const googleIntegrationEnabled = (capabilities ?? []).some(
    (row) => row.capability === "marketing.publish.google_business" && row.enabled === true,
  );
  const googleLiveCapability = (capabilities ?? []).some(
    (row) => row.capability === "marketing.publish.google_business.live" && row.enabled === true,
  );
  const googleLiveAvailable = googleIntegrationEnabled && googleLiveCapability && googleBusinessLiveEnvEnabled();
  const production = isProduction();
  if (production && !googleIntegrationEnabled) {
    return (
      <AdminCard>
        <AdminPageHeader
          title="Publicare"
          subtitle="Publicarea Google Business nu este activată pentru producție."
        />
      </AdminCard>
    );
  }
  const options = (destinations ?? []).flatMap((row) => {
    if (
      row.destination_type !== "facebook_page"
      && row.destination_type !== "instagram_business"
      && row.destination_type !== "google_business_location"
    ) {
      return [];
    }
    return [{
      id: row.id,
      destinationType: row.destination_type,
      displayName: row.display_name,
    }];
  });
  const history = (jobs ?? []).flatMap((row) => {
    const destination = Array.isArray(row.marketing_destinations)
      ? row.marketing_destinations[0]
      : row.marketing_destinations;
    const asset = Array.isArray(row.integration_assets)
      ? row.integration_assets[0]
      : row.integration_assets;
    if (!destination || !row.asset_id) return [];
    if (!row.destination_id) return [];
    return [{
      id: row.id,
      assetId: row.asset_id,
      destinationId: row.destination_id,
      destinationType: destination.destination_type,
      displayName: destination.display_name,
      status: row.status,
      executionMode: row.execution_mode,
      safeError: row.safe_error,
      providerContainerId: row.provider_container_id,
      providerPostId: row.provider_post_id,
      caption: asset?.body ?? null,
    }];
  });

  const visibleDestinations = production
    ? options.filter((destination) => destination.destinationType === "google_business_location")
    : options;

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title="Publicare"
        subtitle="Facebook, Instagram și Google Business. Poți aduce o postare din Marketing AI și o confirmi manual."
      />
      <AdminCard>
        {(production ? googleIntegrationEnabled : integrationEnabled || googleIntegrationEnabled) && visibleDestinations.length > 0 ? (
          <PublishComposer
            liveAvailable={production ? false : liveAvailable}
            googleLiveAvailable={googleLiveAvailable}
            destinations={visibleDestinations}
            history={history}
          />
        ) : (
          <p className="text-sm text-frz-muted">
            {integrationEnabled
              ? "Alege mai întâi paginile și conturile Instagram din Integrări."
              : googleIntegrationEnabled
                ? "Alege mai întâi locația Google Business din Integrări."
                : "Integrarea Meta este oprită pentru acest salon."}
          </p>
        )}
      </AdminCard>
    </div>
  );
}

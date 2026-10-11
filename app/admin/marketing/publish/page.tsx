import { redirect } from "next/navigation";
import AdminCard from "@/app/admin/components/AdminCard";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import PublishComposer from "@/app/admin/marketing/publish/PublishComposer";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { isProduction } from "@/lib/app/environment";
import { metaPublishLiveEnvEnabled } from "@/lib/integrations/meta/publish/flags";
import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MarketingPublishPage() {
  const session = await getAdminSession();
  if (!session?.user) redirect("/login");
  if (!session.tenantId || !canAdministerIntegrations(session.role)) {
    redirect("/admin/dashboard");
  }
  if (isProduction()) {
    return (
      <AdminCard>
        <AdminPageHeader
          title="Publicare"
          subtitle="Publicarea Meta nu este disponibilă în producție."
        />
      </AdminCard>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: capabilities }, { data: destinations }, { data: jobs }] = await Promise.all([
    supabase
      .from("tenant_capabilities")
      .select("capability, enabled")
      .eq("tenant_id", session.tenantId)
      .in("capability", ["marketing.publish.meta", "marketing.publish.meta.live"]),
    supabase
      .from("marketing_destinations")
      .select("id, destination_type, display_name, status")
      .eq("tenant_id", session.tenantId)
      .eq("provider", "meta")
      .eq("status", "active"),
    supabase
      .from("integration_publish_jobs")
      .select("id, asset_id, status, execution_mode, safe_error, marketing_destinations(display_name, destination_type), integration_assets(body)")
      .eq("tenant_id", session.tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const integrationEnabled = (capabilities ?? []).some(
    (row) => row.capability === "marketing.publish.meta" && row.enabled === true,
  );
  const liveCapability = (capabilities ?? []).some(
    (row) => row.capability === "marketing.publish.meta.live" && row.enabled === true,
  );
  const liveAvailable = integrationEnabled && liveCapability && metaPublishLiveEnvEnabled();
  const options = (destinations ?? []).flatMap((row) => {
    if (row.destination_type !== "facebook_page" && row.destination_type !== "instagram_business") {
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
    return [{
      id: row.id,
      assetId: row.asset_id,
      destinationType: destination.destination_type,
      displayName: destination.display_name,
      status: row.status,
      executionMode: row.execution_mode,
      safeError: row.safe_error,
      caption: asset?.body ?? null,
    }];
  });

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title="Publicare"
        subtitle="Facebook și Instagram, separat de Marketing AI."
      />
      <AdminCard>
        {integrationEnabled && options.length > 0 ? (
          <PublishComposer
            liveAvailable={liveAvailable}
            destinations={options}
            history={history}
          />
        ) : (
          <p className="text-sm text-frz-muted">
            {integrationEnabled
              ? "Alege mai întâi paginile și conturile Instagram din Integrări."
              : "Integrarea Meta este oprită pentru acest salon."}
          </p>
        )}
      </AdminCard>
    </div>
  );
}

import { isProduction, isStaging } from "@/lib/app/environment";
import {
  resolveCapabilities,
  stagingMetaOwnerAccessEnabled,
} from "@/lib/integrations/capabilities";
import { supabaseAdmin } from "@/lib/supabase/admin";

export function currentStagingMetaOwnerAccess(): boolean {
  return stagingMetaOwnerAccessEnabled(process.env, {
    production: isProduction(),
    staging: isStaging(),
  });
}

/**
 * Reads only this tenant's Meta rows. A database error stays off.
 * A successful empty result uses the Staging default. An explicit
 * enabled=false row stays off.
 */
export async function readMetaTenantCapabilities(tenantId: string): Promise<{
  integrationEnabled: boolean;
  liveCapabilityEnabled: boolean;
}> {
  const closed = { integrationEnabled: false, liveCapabilityEnabled: false };
  const { data, error } = await supabaseAdmin
    .from("tenant_capabilities")
    .select("capability, enabled")
    .eq("tenant_id", tenantId)
    .in("capability", ["marketing.publish.meta", "marketing.publish.meta.live"]);
  if (error || !data) return closed;
  const resolved = resolveCapabilities(data, {
    stagingMetaOwnerAccess: currentStagingMetaOwnerAccess(),
  });
  return {
    integrationEnabled: resolved["marketing.publish.meta"],
    liveCapabilityEnabled: resolved["marketing.publish.meta.live"],
  };
}

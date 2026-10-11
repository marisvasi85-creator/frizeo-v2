import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { isProduction } from "@/lib/app/environment";
import { assertMetaConfig, type MetaReadyConfig } from "@/lib/integrations/meta/config";
import { stagingSettingsUrl, type MetaNotice } from "@/lib/integrations/meta/flow";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export function metaSettingsRedirect(notice: MetaNotice): NextResponse {
  const key = notice === "select" || notice === "saved" ? "meta" : "meta_error";
  return NextResponse.redirect(stagingSettingsUrl({ [key]: notice }), 303);
}

export async function metaProductionBlocked(): Promise<NextResponse | null> {
  if (!isProduction()) return null;
  return NextResponse.json({ error: "not_configured" }, { status: 404 });
}

export async function metaRateLimit(
  request: Request,
  bucket: string,
  identifier: string,
): Promise<NextResponse | null> {
  return enforceRateLimit(request, {
    bucket,
    limit: 10,
    windowSeconds: 600,
    identifier,
  });
}

export async function metaCapabilityEnabled(tenantId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("tenant_capabilities")
    .select("enabled")
    .eq("tenant_id", tenantId)
    .eq("capability", "marketing.publish.meta")
    .maybeSingle();
  if (error || !data) return false;
  return data.enabled === true;
}

export async function loadMetaRequestContext() {
  const session = await getAdminSession();
  const production = isProduction();
  const configResult = assertMetaConfig(process.env, { production });
  const capabilityEnabled = session?.tenantId
    ? await metaCapabilityEnabled(session.tenantId)
    : false;
  const config: MetaReadyConfig | null = configResult.ok ? configResult.config : null;
  return { session, production, configured: configResult.ok, config, capabilityEnabled };
}

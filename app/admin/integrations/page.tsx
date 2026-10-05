import { redirect } from "next/navigation";
import AdminButton from "@/app/admin/components/AdminButton";
import AdminCard from "@/app/admin/components/AdminCard";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { buildLabProviderStatus, validationPlan } from "@/lib/integrations/labStatus";
import { canAccessIntegrationLab } from "@/lib/integrations/permissions";
import {
  INTEGRATION_PROVIDERS,
  PROVIDER_LABELS,
  isIntegrationProvider,
} from "@/lib/integrations/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function IntegrationLabPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!canAccessIntegrationLab(user.email)) redirect("/admin/dashboard");

  const snapshot = await loadLabSnapshot();
  const validation = validationPlan();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Integration Lab"
        subtitle="Doar Platform Creator. Nu se apelează provideri externi."
      />

      <div className="grid gap-4">
        {INTEGRATION_PROVIDERS.map((provider) => {
          const status = snapshot[provider];
          return (
            <AdminCard key={provider}>
              <h2 className="text-lg font-semibold text-frz-ink">
                {PROVIDER_LABELS[provider]}
              </h2>
              <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                <div>Provider: {provider}</div>
                <div>Feature: {status.feature}</div>
                <div>OAuth: {status.oauth}</div>
                <div>Publish: {status.publish}</div>
                <div>Connections count: {status.connectionsCount}</div>
                <div>Destinations count: {status.destinationsCount}</div>
                <div>Last validation: {status.lastValidation ?? "—"}</div>
                <div>Last safe error: {status.lastSafeError ?? "—"}</div>
              </dl>
              <div className="mt-4">
                <AdminButton type="button" variant="secondary" disabled>
                  Rulează validarea
                </AdminButton>
                {!validation.runnable && (
                  <p className="mt-2 text-xs text-frz-muted">
                    Validarea rămâne oprită până există un adapter real.
                  </p>
                )}
              </div>
            </AdminCard>
          );
        })}
      </div>
    </div>
  );
}

async function loadLabSnapshot() {
  const [connectionsRes, destinationsRes, capabilitiesRes] = await Promise.all([
    supabaseAdmin
      .from("marketing_connections")
      .select("provider, last_validated_at, last_error"),
    supabaseAdmin.from("marketing_destinations").select("provider"),
    supabaseAdmin
      .from("tenant_capabilities")
      .select("capability")
      .eq("enabled", true),
  ]);

  const connections = connectionsRes.error ? [] : connectionsRes.data ?? [];
  const destinations = destinationsRes.error ? [] : destinationsRes.data ?? [];
  const explicitEnables = (capabilitiesRes.error ? [] : capabilitiesRes.data ?? []).map(
    (row) => row.capability,
  );

  return Object.fromEntries(
    INTEGRATION_PROVIDERS.map((provider) => {
      const providerConnections = connections.filter(
        (row) => isIntegrationProvider(row.provider) && row.provider === provider,
      );
      const lastValidation = providerConnections
        .map((row) => row.last_validated_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
      const lastError = providerConnections
        .map((row) => row.last_error)
        .filter((value): value is string => Boolean(value))
        .at(-1) ?? null;

      return [
        provider,
        buildLabProviderStatus({
          provider,
          explicitEnables,
          connectionsCount: providerConnections.length,
          destinationsCount: destinations.filter((row) => row.provider === provider).length,
          lastValidation,
          lastError,
        }),
      ];
    }),
  );
}

import {
  isProductionHostname,
  isStagingHostname,
  normalizeHostname,
} from "@/lib/app/environment";

/** Staging-only salon that may record acceptance. Other salons stay off. */
export const DPA_STAGING_ACCEPTANCE_TENANT_ID =
  "5d9862a1-fd85-46f2-9c7e-635e813e067c";

export function dpaAcceptanceEnabledForTenant(input: {
  tenantId: string | null;
  hostname?: string | null;
  stagingRuntime: boolean;
}): boolean {
  if (!input.tenantId) return false;
  if (input.tenantId !== DPA_STAGING_ACCEPTANCE_TENANT_ID) return false;
  const host = normalizeHostname(input.hostname);
  if (isProductionHostname(host)) return false;
  if (isStagingHostname(host)) return true;
  return input.stagingRuntime && !isProductionHostname(host);
}

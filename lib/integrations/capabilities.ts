/**
 * Frizeo 2.0 capabilities.
 * A missing row is OFF. Commercial plans are not consulted.
 *
 * On Staging only, the two Meta owner capabilities default to ON when no row
 * exists. An explicit row always wins, including enabled=false. Production
 * never receives that default. Set STAGING_META_OWNER_ACCESS=false to turn
 * the Staging default off without removing the per-tenant kill switch.
 */

export const FRIZEO_V2_CAPABILITIES = [
  "booking.core",
  "growth.recall",
  "growth.fill",
  "growth.analytics",
  "marketing.generate",
  "marketing.publish.meta",
  "marketing.publish.meta.live",
  "marketing.publish.google_business",
  "marketing.publish.tiktok",
  "marketing.publish.whatsapp",
  "marketing.attribution",
  "studio.hair_preview",
  "studio.recreate",
  "studio.mirror",
  "studio.before_after",
  "studio.portfolio",
] as const;

export type FrizeoV2Capability = (typeof FRIZEO_V2_CAPABILITIES)[number];

export type CapabilityMap = Record<FrizeoV2Capability, boolean>;

const CAPABILITY_SET = new Set<string>(FRIZEO_V2_CAPABILITIES);

export const STAGING_META_OWNER_ACCESS_ENV = "STAGING_META_OWNER_ACCESS";

const STAGING_DEFAULT_META_CAPABILITIES = [
  "marketing.publish.meta",
  "marketing.publish.meta.live",
] as const satisfies readonly FrizeoV2Capability[];

export function stagingMetaOwnerAccessEnabled(
  env: Record<string, string | undefined>,
  runtime: { production: boolean; staging: boolean },
): boolean {
  if (runtime.production || !runtime.staging) return false;
  const value = env[STAGING_META_OWNER_ACCESS_ENV]?.trim().toLowerCase() ?? "";
  return value !== "false" && value !== "0" && value !== "off";
}

export function isFrizeoV2Capability(
  value: string,
): value is FrizeoV2Capability {
  return CAPABILITY_SET.has(value);
}

export function defaultCapabilityMap(): CapabilityMap {
  return FRIZEO_V2_CAPABILITIES.reduce((map, capability) => {
    map[capability] = false;
    return map;
  }, {} as CapabilityMap);
}

export function resolveCapabilities(
  overrides: readonly { capability: string; enabled: boolean }[],
  options?: { stagingMetaOwnerAccess?: boolean },
): CapabilityMap {
  const resolved = defaultCapabilityMap();
  if (options?.stagingMetaOwnerAccess === true) {
    for (const capability of STAGING_DEFAULT_META_CAPABILITIES) {
      resolved[capability] = true;
    }
  }
  for (const row of overrides) {
    if (!isFrizeoV2Capability(row.capability)) continue;
    resolved[row.capability] = row.enabled === true;
  }
  return resolved;
}

export function capabilityEnabled(
  map: CapabilityMap,
  capability: FrizeoV2Capability,
): boolean {
  return map[capability] === true;
}

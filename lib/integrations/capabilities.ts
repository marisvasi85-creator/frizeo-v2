/**
 * Frizeo 2.0 capabilities.
 * A missing row is OFF. Current commercial plans are not consulted.
 */

export const FRIZEO_V2_CAPABILITIES = [
  "booking.core",
  "growth.recall",
  "growth.fill",
  "growth.analytics",
  "marketing.generate",
  "marketing.publish.meta",
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
): CapabilityMap {
  const resolved = defaultCapabilityMap();
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

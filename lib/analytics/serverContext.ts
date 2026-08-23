import "server-only";

import type { FirstPartyAnalyticsContext } from "./firstParty";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function parseFirstPartyAnalyticsContext(
  value: unknown,
): FirstPartyAnalyticsContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const visitorId = clean(input.visitorId, 36);
  const sessionId = clean(input.sessionId, 36);
  const source = clean(input.source, 120);
  const landingPath = clean(input.landingPath, 500);

  if (
    !visitorId ||
    !sessionId ||
    !UUID_PATTERN.test(visitorId) ||
    !UUID_PATTERN.test(sessionId) ||
    !source ||
    !landingPath ||
    !landingPath.startsWith("/")
  ) {
    return null;
  }

  return {
    visitorId,
    sessionId,
    source,
    medium: clean(input.medium, 120),
    campaign: clean(input.campaign, 180),
    landingPath,
    referrerHost: clean(input.referrerHost, 255),
  };
}

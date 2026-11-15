const MEDIA_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

/** Orphan campaign text and private images only. Publish history is not covered. */
export const ORPHAN_MARKETING_RETENTION_DAYS = 90;

export function marketingRetentionDays(
  env: Record<string, string | undefined>,
): number | null {
  const raw = env.MARKETING_DATA_RETENTION_DAYS?.trim() ?? "";
  if (raw !== String(ORPHAN_MARKETING_RETENTION_DAYS)) return null;
  return ORPHAN_MARKETING_RETENTION_DAYS;
}

export function isRetentionMediaPath(path: string): boolean {
  return MEDIA_PATH.test(path);
}

export type RetentionCandidate = {
  assets: Array<{ id: string; path: string }>;
  orphans: string[];
};

export function readRetentionCandidates(value: unknown): RetentionCandidate | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { outcome?: unknown; assets?: unknown; orphans?: unknown };
  if (body.outcome !== "ready" || !Array.isArray(body.assets) || !Array.isArray(body.orphans)) {
    return null;
  }
  const assets = body.assets.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; path?: unknown };
    if (typeof row.id !== "string" || typeof row.path !== "string") return [];
    if (!isRetentionMediaPath(row.path)) return [];
    return [{ id: row.id, path: row.path }];
  });
  const orphans = body.orphans.filter((path): path is string => (
    typeof path === "string" && isRetentionMediaPath(path)
  ));
  return { assets, orphans };
}

export function retentionFilePaths(candidates: RetentionCandidate): string[] {
  return [...new Set([
    ...candidates.assets.map((asset) => asset.path),
    ...candidates.orphans,
  ])];
}

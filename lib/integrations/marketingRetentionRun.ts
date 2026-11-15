import { MARKETING_PUBLISH_BUCKET } from "@/lib/integrations/meta/publish/flags";
import {
  marketingRetentionDays,
  readRetentionCandidates,
  retentionFilePaths,
} from "@/lib/integrations/marketingRetention";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function runMarketingRetention(
  env: Record<string, string | undefined> = process.env,
): Promise<
  | { outcome: "off" | "rejected" | "failed"; deletedFiles: 0; deletedAssets: 0 }
  | { outcome: "applied"; deletedFiles: number; deletedAssets: number }
> {
  const days = marketingRetentionDays(env);
  if (!days) return { outcome: "off", deletedFiles: 0, deletedAssets: 0 };

  const { data, error } = await supabaseAdmin.rpc("marketing_retention_candidates", {
    p_days: days,
  });
  if (error) return { outcome: "failed", deletedFiles: 0, deletedAssets: 0 };
  const candidates = readRetentionCandidates(data);
  if (!candidates) return { outcome: "rejected", deletedFiles: 0, deletedAssets: 0 };

  const paths = retentionFilePaths(candidates);
  let deletedFiles = 0;
  if (paths.length > 0) {
    const removed = await supabaseAdmin.storage.from(MARKETING_PUBLISH_BUCKET).remove(paths);
    if (removed.error) return { outcome: "failed", deletedFiles: 0, deletedAssets: 0 };
    deletedFiles = paths.length;
  }

  const { data: applied, error: applyError } = await supabaseAdmin.rpc("marketing_retention_apply", {
    p_days: days,
    p_asset_ids: candidates.assets.map((asset) => asset.id),
  });
  const assets = applied && typeof applied === "object"
    ? (applied as { assets?: unknown }).assets
    : null;
  if (applyError || typeof assets !== "number") {
    return { outcome: "failed", deletedFiles: 0, deletedAssets: 0 };
  }
  return { outcome: "applied", deletedFiles, deletedAssets: assets };
}

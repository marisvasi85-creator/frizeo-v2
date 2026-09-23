import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  groupHistoryRows,
  type MarketingAIHistoryBatch,
  type MarketingHistoryRow,
} from "./historyTypes";
import { hasMarketingAIUsageTable } from "./usage";

export type { MarketingAIHistoryBatch, MarketingAIHistoryItem } from "./historyTypes";
export { historyItemToResult } from "./historyTypes";

let payloadColumnsReady: boolean | null = null;

export async function hasMarketingAIPayloadColumns(): Promise<boolean> {
  if (payloadColumnsReady !== null) return payloadColumnsReady;

  const tableReady = await hasMarketingAIUsageTable();
  if (!tableReady) {
    payloadColumnsReady = false;
    return false;
  }

  const { error } = await supabaseAdmin
    .from("marketing_ai_generations")
    .select("id, title, content, hashtags, call_to_action")
    .limit(1);

  payloadColumnsReady = !error;
  return payloadColumnsReady;
}

const HISTORY_COLUMNS =
  "id, content_type, provider, created_at, title, content, hashtags, call_to_action, barber_id, tone, extra_notes, service_id, channel, variant_index, generation_batch_id, context_snapshot";

const LEGACY_HISTORY_COLUMNS =
  "id, content_type, provider, created_at, title, content, hashtags, call_to_action, barber_id";

export async function listMarketingAIHistory(input: {
  tenantId: string;
  barberId?: string | null;
  limit?: number;
}): Promise<MarketingAIHistoryBatch[]> {
  const ready = await hasMarketingAIPayloadColumns();
  if (!ready) return [];

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const fetchLimit = Math.min(limit * 3, 60);

  async function run(columns: string) {
    let query = supabaseAdmin
      .from("marketing_ai_generations")
      .select(columns)
      .eq("tenant_id", input.tenantId)
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    if (input.barberId) {
      query = query.eq("barber_id", input.barberId);
    }
    return query;
  }

  let { data, error } = await run(HISTORY_COLUMNS);
  if (error) {
    const legacy = await run(LEGACY_HISTORY_COLUMNS);
    data = legacy.data;
    error = legacy.error;
  }

  if (error || !data) return [];
  return groupHistoryRows(data as unknown as MarketingHistoryRow[], limit);
}

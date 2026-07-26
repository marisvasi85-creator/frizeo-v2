import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MarketingAIHistoryItem } from "./historyTypes";
import { hasMarketingAIUsageTable } from "./usage";

export type { MarketingAIHistoryItem } from "./historyTypes";
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

function parseHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === "string");
}

export async function listMarketingAIHistory(input: {
  tenantId: string;
  barberId?: string | null;
  limit?: number;
}): Promise<MarketingAIHistoryItem[]> {
  const ready = await hasMarketingAIPayloadColumns();
  if (!ready) return [];

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

  let query = supabaseAdmin
    .from("marketing_ai_generations")
    .select(
      "id, content_type, provider, created_at, title, content, hashtags, call_to_action, barber_id",
    )
    .eq("tenant_id", input.tenantId)
    .not("content", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.barberId) {
    query = query.eq("barber_id", input.barberId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .filter((row) => typeof row.content === "string" && row.content.length > 0)
    .map((row) => ({
      id: row.id as string,
      contentType: row.content_type as string,
      provider: row.provider as string,
      createdAt: row.created_at as string,
      title: (row.title as string | null) || "Conținut generat",
      content: row.content as string,
      hashtags: parseHashtags(row.hashtags),
      callToAction:
        (row.call_to_action as string | null) || "Programează-te online!",
      barberId: (row.barber_id as string | null) ?? null,
    }));
}

export async function getMarketingAIHistoryItem(input: {
  tenantId: string;
  id: string;
  barberId?: string | null;
}): Promise<MarketingAIHistoryItem | null> {
  const ready = await hasMarketingAIPayloadColumns();
  if (!ready) return null;

  const { data, error } = await supabaseAdmin
    .from("marketing_ai_generations")
    .select(
      "id, content_type, provider, created_at, title, content, hashtags, call_to_action, barber_id",
    )
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .maybeSingle();

  if (error || !data || typeof data.content !== "string") return null;

  if (input.barberId && data.barber_id && data.barber_id !== input.barberId) {
    return null;
  }

  return {
    id: data.id as string,
    contentType: data.content_type as string,
    provider: data.provider as string,
    createdAt: data.created_at as string,
    title: (data.title as string | null) || "Conținut generat",
    content: data.content as string,
    hashtags: parseHashtags(data.hashtags),
    callToAction:
      (data.call_to_action as string | null) || "Programează-te online!",
    barberId: (data.barber_id as string | null) ?? null,
  };
}

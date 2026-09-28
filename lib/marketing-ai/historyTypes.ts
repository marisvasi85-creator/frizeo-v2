import type { GenerateMarketingResult, MarketingContentType, MarketingTone, OpenSlotDayFact } from "./types";

export type MarketingAIHistoryItem = {
  id: string;
  contentType: MarketingContentType | string;
  provider: string;
  createdAt: string;
  title: string;
  content: string;
  hashtags: string[];
  callToAction: string;
  barberId: string | null;
  tone: MarketingTone | string | null;
  extraNotes: string | null;
  serviceId: string | null;
  channel: string | null;
  variantIndex: number | null;
  batchId: string | null;
};

export type MarketingAIHistoryBatch = {
  id: string;
  contentType: string;
  provider: string;
  createdAt: string;
  tone: string | null;
  extraNotes: string | null;
  serviceId: string | null;
  serviceName: string | null;
  barberId: string | null;
  barberName: string | null;
  channel: string | null;
  availability: OpenSlotDayFact[] | null;
  variants: MarketingAIHistoryItem[];
};

export function historyItemToResult(
  item: MarketingAIHistoryItem,
): GenerateMarketingResult {
  return {
    title: item.title,
    content: item.content,
    hashtags: item.hashtags,
    callToAction: item.callToAction,
  };
}

export type MarketingHistoryRow = {
  id: string;
  content_type: string;
  provider: string;
  created_at: string;
  title: string | null;
  content: string | null;
  hashtags: unknown;
  call_to_action: string | null;
  barber_id: string | null;
  tone?: string | null;
  extra_notes?: string | null;
  service_id?: string | null;
  channel?: string | null;
  variant_index?: number | null;
  generation_batch_id?: string | null;
  context_snapshot?: unknown;
};

function parseHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === "string");
}

function snapshotString(snapshot: unknown, key: string): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function snapshotAvailability(snapshot: unknown): OpenSlotDayFact[] | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const value = (snapshot as Record<string, unknown>).availability;
  if (!Array.isArray(value)) return null;
  const days = value.flatMap((item): OpenSlotDayFact[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.date !== "string" || typeof row.weekday !== "string") return [];
    const durationMinutes =
      typeof row.durationMinutes === "number" && row.durationMinutes > 0
        ? row.durationMinutes
        : null;
    const freeCount =
      durationMinutes != null && typeof row.freeCount === "number" ? row.freeCount : null;
    const sampleTimes = Array.isArray(row.sampleTimes)
      ? row.sampleTimes.filter((time): time is string => typeof time === "string")
      : [];
    return [
      {
        date: row.date,
        weekday: row.weekday,
        freeCount,
        sampleTimes: freeCount == null ? [] : sampleTimes,
        durationMinutes,
      },
    ];
  });
  return days.length ? days : null;
}

export function rowToHistoryItem(row: MarketingHistoryRow): MarketingAIHistoryItem | null {
  if (typeof row.content !== "string" || !row.content.length) return null;
  return {
    id: row.id,
    contentType: row.content_type,
    provider: row.provider,
    createdAt: row.created_at,
    title: row.title || "Conținut generat",
    content: row.content,
    hashtags: parseHashtags(row.hashtags),
    callToAction: row.call_to_action || "Programează-te online!",
    barberId: row.barber_id,
    tone: row.tone ?? null,
    extraNotes: row.extra_notes ?? null,
    serviceId: row.service_id ?? null,
    channel: row.channel ?? null,
    variantIndex: row.variant_index ?? null,
    batchId: row.generation_batch_id ?? null,
  };
}

export function groupHistoryRows(
  rows: MarketingHistoryRow[],
  limit = 20,
): MarketingAIHistoryBatch[] {
  const batches: MarketingAIHistoryBatch[] = [];
  const indexByKey = new Map<string, number>();

  for (const row of rows) {
    const item = rowToHistoryItem(row);
    if (!item) continue;
    const key = item.batchId || item.id;
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      if (batches.length >= limit) continue;
      indexByKey.set(key, batches.length);
      batches.push({
        id: key,
        contentType: item.contentType,
        provider: item.provider,
        createdAt: item.createdAt,
        tone: item.tone,
        extraNotes: item.extraNotes,
        serviceId: item.serviceId,
        serviceName: snapshotString(row.context_snapshot, "serviceName"),
        barberId: item.barberId,
        barberName: snapshotString(row.context_snapshot, "barberName"),
        channel: item.channel,
        availability: snapshotAvailability(row.context_snapshot),
        variants: [item],
      });
      continue;
    }
    batches[existing].variants.push(item);
  }

  for (const batch of batches) {
    batch.variants.sort(
      (a, b) => (a.variantIndex ?? 0) - (b.variantIndex ?? 0),
    );
  }

  return batches;
}

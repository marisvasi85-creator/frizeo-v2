"use client";

import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import type { MarketingAIHistoryBatch } from "@/lib/marketing-ai/historyTypes";
import { MARKETING_CHANNEL_LABELS, isMarketingChannel } from "@/lib/marketing-ai/channels";
import { getMarketingContentTypeLabel } from "@/lib/marketing-ai/seasonal";
import { MARKETING_TONE_LABELS, isMarketingTone } from "@/lib/marketing-ai/types";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function toneLabel(tone: string | null): string {
  if (tone && isMarketingTone(tone)) return MARKETING_TONE_LABELS[tone];
  return "Ton nesalvat";
}

export default function HistoryList({
  batches,
  loading,
  activeId,
  onSelect,
  onRefresh,
}: {
  batches: MarketingAIHistoryBatch[];
  loading: boolean;
  activeId: string | null;
  onSelect: (batch: MarketingAIHistoryBatch) => void;
  onRefresh: () => void;
}) {
  return (
    <AdminCard className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-frz-ink">Istoric</p>
          <p className="text-xs text-frz-muted mt-1">
            O generare, cu variantele ei. Redeschiderea nu consumă din limita zilei.
          </p>
        </div>
        <AdminButton
          variant="secondary"
          size="sm"
          loading={loading}
          loadingLabel="Se încarcă..."
          onClick={onRefresh}
        >
          Reîmprospătează
        </AdminButton>
      </div>

      {batches.length === 0 && !loading && (
        <p className="text-sm text-frz-muted">
          Încă nu ai generări salvate.
        </p>
      )}

      {batches.length > 0 && (
        <ul className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden">
          {batches.map((batch) => {
            const active = activeId === batch.id;
            const channel =
              batch.channel && isMarketingChannel(batch.channel)
                ? MARKETING_CHANNEL_LABELS[batch.channel]
                : null;
            return (
              <li key={batch.id}>
                <button
                  type="button"
                  onClick={() => onSelect(batch)}
                  className={`w-full text-left px-4 py-3 transition ${
                    active ? "bg-frz-mist" : "bg-transparent hover:bg-frz-fog"
                  }`}
                >
                  <p className="text-sm font-medium text-frz-ink truncate">
                    {batch.variants[0]?.title || "Conținut generat"}
                  </p>
                  <p className="text-xs text-frz-muted mt-1">
                    {getMarketingContentTypeLabel(batch.contentType)}
                    {channel ? ` · ${channel}` : ""}
                    {" · "}
                    {toneLabel(batch.tone)}
                    {batch.serviceName ? ` · ${batch.serviceName}` : ""}
                    {batch.barberName ? ` · ${batch.barberName}` : ""}
                    {" · "}
                    {formatWhen(batch.createdAt)}
                    {batch.variants.length > 1
                      ? ` · ${batch.variants.length} variante`
                      : ""}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AdminCard>
  );
}

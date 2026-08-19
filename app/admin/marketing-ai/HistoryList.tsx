"use client";

import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import type { MarketingAIHistoryItem } from "@/lib/marketing-ai/historyTypes";
import { getMarketingContentTypeLabel } from "@/lib/marketing-ai/seasonal";

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

export default function HistoryList({
  items,
  loading,
  activeId,
  onSelect,
  onRefresh,
}: {
  items: MarketingAIHistoryItem[];
  loading: boolean;
  activeId: string | null;
  onSelect: (item: MarketingAIHistoryItem) => void;
  onRefresh: () => void;
}) {
  return (
    <AdminCard className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-frz-ink">Istoric generări</p>
          <p className="text-xs text-frz-muted mt-1">
            Redeschide un text salvat — fără să consume din limita zilnică.
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

      {items.length === 0 && !loading && (
        <p className="text-sm text-frz-muted">
          Încă nu ai generări salvate. Creează prima postare mai jos.
        </p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden">
          {items.map((item) => {
            const label = getMarketingContentTypeLabel(item.contentType);
            const active = activeId === item.id;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`w-full text-left px-4 py-3 transition ${
                    active
                      ? "bg-frz-mist"
                      : "bg-transparent hover:bg-frz-fog"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-frz-ink truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-frz-muted mt-1">
                        {label} · {formatWhen(item.createdAt)}
                      </p>
                      <p className="text-xs text-frz-muted mt-1 line-clamp-2">
                        {item.content}
                      </p>
                    </div>
                    <span className="text-xs text-sky-300 shrink-0 pt-0.5">
                      Deschide
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AdminCard>
  );
}

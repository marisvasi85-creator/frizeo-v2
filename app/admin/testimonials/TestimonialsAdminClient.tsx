"use client";

import { useState } from "react";
import Image from "next/image";
import type {
  MarketingTestimonial,
  MarketingTestimonialStatus,
} from "@/lib/marketing-testimonials/types";

function statusLabel(status: MarketingTestimonialStatus) {
  if (status === "approved") return "Aprobată";
  if (status === "rejected") return "Respinsă";
  return "În așteptare";
}

function statusClass(status: MarketingTestimonialStatus) {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-700";
  if (status === "rejected") return "bg-red-500/10 text-red-700";
  return "bg-amber-500/15 text-amber-800";
}

function userTypeLabel(userType: MarketingTestimonial["user_type"]) {
  return userType === "barbershop" ? "Barbershop" : "Frizer independent";
}

export default function TestimonialsAdminClient({
  initialItems,
}: {
  initialItems: MarketingTestimonial[];
}) {
  const [items, setItems] = useState(initialItems);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function updateStatus(id: string, status: "approved" | "rejected") {
    setError("");
    setLoadingId(id);
    try {
      const res = await fetch(`/api/marketing-testimonials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Nu s-a putut actualiza recenzia.");
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                reviewed_at: new Date().toISOString(),
              }
            : item,
        ),
      );
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setLoadingId(null);
    }
  }

  const pendingCount = items.filter((item) => item.status === "pending").length;

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <div className="inline-flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full mb-3">
          Creator only
        </div>
        <h1 className="text-2xl font-semibold">Recenzii</h1>
        <p className="text-frz-ink/60 mt-1">
          Recenzii trimise de frizeri despre Frizeo. Aprobă doar ce vrei afișat
          pe homepage.
        </p>
        {pendingCount > 0 && (
          <p className="mt-2 text-sm text-amber-800">
            {pendingCount} în așteptare
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-frz-line bg-frz-card p-8 text-center text-frz-ink/60">
          Nicio recenzie încă.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-frz-line bg-frz-card p-4 md:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500" aria-hidden>
                      {"★".repeat(item.rating)}
                    </span>
                    <span className="font-semibold text-frz-ink">
                      {item.author_name}
                    </span>
                  </div>
                  <p className="text-sm text-frz-ink/60 mt-1">
                    {userTypeLabel(item.user_type)}
                    {item.salon_name ? ` · ${item.salon_name}` : ""}
                    {item.city ? ` · ${item.city}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(item.status)}`}
                >
                  {statusLabel(item.status)}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-frz-ink/80 whitespace-pre-wrap">
                {item.body}
              </p>

              {item.photo_url && (
                <div className="relative h-40 w-40 overflow-hidden rounded-xl border border-frz-line">
                  <Image
                    src={item.photo_url}
                    alt={`Poză ${item.author_name}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {item.status !== "approved" && (
                  <button
                    type="button"
                    disabled={loadingId === item.id}
                    onClick={() => updateStatus(item.id, "approved")}
                    className="rounded-lg bg-frz-ink px-3 py-1.5 text-sm font-medium text-frz-ink-contrast hover:bg-frz-ink-soft disabled:opacity-50"
                  >
                    Aprobă
                  </button>
                )}
                {item.status !== "rejected" && (
                  <button
                    type="button"
                    disabled={loadingId === item.id}
                    onClick={() => updateStatus(item.id, "rejected")}
                    className="rounded-lg border border-frz-line px-3 py-1.5 text-sm text-frz-ink/70 hover:bg-frz-fog disabled:opacity-50"
                  >
                    Respinge
                  </button>
                )}
                <span className="text-xs text-frz-ink/40 ml-auto">
                  {new Date(item.created_at).toLocaleString("ro-RO")}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

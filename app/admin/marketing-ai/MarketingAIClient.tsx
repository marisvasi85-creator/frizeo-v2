"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import { AdminSelect } from "../components/AdminInput";
import type { BrandedCardBranding } from "@/lib/marketing-ai/brandedCard";
import type { MarketingAIHistoryItem } from "@/lib/marketing-ai/historyTypes";
import { historyItemToResult } from "@/lib/marketing-ai/historyTypes";
import { getAvailableMarketingActions } from "@/lib/marketing-ai/seasonal";
import { copyTextToClipboard } from "@/lib/marketing-ai/share";
import {
  MARKETING_EXTRA_NOTES_MAX,
  MARKETING_TONE_LABELS,
  MARKETING_TONES,
  type MarketingContentType,
  type MarketingTone,
} from "@/lib/marketing-ai/types";
import BrandedCardButton from "./BrandedCardButton";
import HistoryList from "./HistoryList";
import ShareKit from "./ShareKit";
import SocialLinksBar from "./SocialLinksBar";
import type { SocialLinks } from "@/lib/social/normalizeSocialUrl";

type ServiceOption = {
  id: string;
  name: string;
  duration: number;
};

type BarberOption = {
  id: string;
  name: string;
};

type GeneratedResult = {
  title: string;
  content: string;
  hashtags: string[];
  callToAction: string;
};

type UsageStatus = {
  used: number;
  limit: number | null;
  remaining: number | null;
  planLabel: string;
  unlimited: boolean;
  countsTowardLimit: boolean;
  migrationReady: boolean;
};

export default function MarketingAIClient({
  role,
  barbers,
  services,
  defaultBarberId,
  configured,
  provider,
  model,
  modeLabel,
  isFreeTier,
  diagnostics,
  usage: initialUsage,
  initialSocialLinks,
  initialHistory,
}: {
  role: string | null;
  barbers: BarberOption[];
  services: ServiceOption[];
  defaultBarberId: string;
  configured: boolean;
  provider: string;
  model: string;
  modeLabel: string;
  isFreeTier: boolean;
  diagnostics: {
    geminiKeySet: boolean;
    openaiKeySet: boolean;
    explicitProvider: string | null;
  };
  usage: UsageStatus;
  initialSocialLinks: SocialLinks;
  initialHistory: MarketingAIHistoryItem[];
}) {
  const actions = useMemo(() => getAvailableMarketingActions(), []);
  const [usage, setUsage] = useState(initialUsage);
  const [selectedBarberId, setSelectedBarberId] = useState(defaultBarberId);
  const [barberServices, setBarberServices] = useState(services);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [tone, setTone] = useState<MarketingTone>("relaxed");
  const [loadingType, setLoadingType] = useState<MarketingContentType | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [variants, setVariants] = useState<GeneratedResult[]>([]);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [resultContentType, setResultContentType] = useState<
    MarketingContentType | string | null
  >(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [generationIds, setGenerationIds] = useState<string[]>([]);
  const [history, setHistory] = useState<MarketingAIHistoryItem[]>(initialHistory);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [branding, setBranding] = useState<BrandedCardBranding | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(initialSocialLinks);

  const result = variants[activeVariantIndex] || null;

  async function loadBranding(barberId: string): Promise<BrandedCardBranding | null> {
    const res = await fetch(`/api/marketing-ai/branding?barberId=${barberId}`);
    const data = await res.json();
    if (!res.ok) return null;

    setSocialLinks({
      instagram: data.socialLinks?.instagram ?? null,
      facebook: data.socialLinks?.facebook ?? null,
      tiktok: data.socialLinks?.tiktok ?? null,
    });

    const next: BrandedCardBranding = {
      salonName: data.salonName,
      barberName: data.barberName,
      logoUrl: data.logoUrl,
      bookingUrl: data.bookingUrl,
    };
    setBranding(next);
    return next;
  }

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/marketing-ai/history?limit=20");
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setHistory(data.items);
      }
    } catch {
      // keep existing list
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBarberId === defaultBarberId) {
      setBarberServices(services);
      setSelectedServiceId("");
      return;
    }

    let cancelled = false;

    fetch(`/api/services?barberId=${selectedBarberId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setBarberServices(
          (data.services || []).map(
            (service: {
              id: string;
              display_name?: string;
              name: string;
              duration: number;
            }) => ({
              id: service.id,
              name: service.display_name || service.name,
              duration: service.duration,
            }),
          ),
        );
        setSelectedServiceId("");
      })
      .catch(() => {
        if (!cancelled) setBarberServices([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBarberId, defaultBarberId, services]);

  useEffect(() => {
    loadBranding(selectedBarberId).catch(() => setBranding(null));
  }, [selectedBarberId]);

  const fullText = useMemo(() => {
    if (!result) return "";
    const tags = result.hashtags.length
      ? `\n\n${result.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}`
      : "";
    return `${result.content}\n\n${result.callToAction}${tags}`;
  }, [result]);

  async function handleGenerate(type: MarketingContentType, needsService?: boolean) {
    setError("");
    setWarning("");
    setCopied(false);

    if (!configured) {
      setError("Marketing AI nu este configurat pe server. Verifică variabilele de environment.");
      return;
    }

    if (needsService && !selectedServiceId) {
      setError("Alege mai întâi serviciul de promovat.");
      return;
    }

    setLoadingType(type);

    try {
      const res = await fetch("/api/marketing-ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: type,
          barberId: selectedBarberId,
          serviceId: needsService ? selectedServiceId : undefined,
          extraNotes: extraNotes.trim() || undefined,
          tone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.usage) {
          setUsage(data.usage);
        }
        throw new Error(data.error || "Nu am putut genera conținutul");
      }

      const nextVariants: GeneratedResult[] = Array.isArray(data.variants)
        ? data.variants
        : data.result
          ? [data.result]
          : [];

      setVariants(nextVariants);
      setActiveVariantIndex(0);
      setResultContentType(data.contentType || type);
      setGenerationIds(
        Array.isArray(data.generationIds)
          ? data.generationIds
          : data.generationId
            ? [data.generationId]
            : [],
      );
      setActiveHistoryId(
        Array.isArray(data.generationIds)
          ? data.generationIds[0] || null
          : data.generationId || null,
      );
      if (data.warning) {
        setWarning(data.warning);
      }
      if (data.usage) {
        setUsage(data.usage);
      }
      void refreshHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eroare la generare");
      setVariants([]);
      setResultContentType(null);
      setActiveHistoryId(null);
      setGenerationIds([]);
    } finally {
      setLoadingType(null);
    }
  }

  function handleSelectHistory(item: MarketingAIHistoryItem) {
    setError("");
    setWarning("");
    setCopied(false);
    setVariants([historyItemToResult(item)]);
    setActiveVariantIndex(0);
    setResultContentType(item.contentType);
    setActiveHistoryId(item.id);
    setGenerationIds([item.id]);
  }

  function handleSelectVariant(index: number) {
    setActiveVariantIndex(index);
    setCopied(false);
    setActiveHistoryId(generationIds[index] || generationIds[0] || null);
  }

  async function handleCopy() {
    if (!fullText) return;
    await copyTextToClipboard(fullText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <SocialLinksBar links={socialLinks} />

      {!configured && (
        <AdminCard className="border-amber-200 bg-amber-50">
          <p className="text-amber-700 text-sm">
            Marketing AI nu este configurat. Setează un provider în Vercel sau lasă implicit{" "}
            <code className="text-amber-50">template</code> pentru testare gratuită.
          </p>
        </AdminCard>
      )}

      {configured && (
        <AdminCard
          className={
            isFreeTier
              ? "border-emerald-200 bg-emerald-50"
              : "border-frz-line"
          }
        >
          <p className="text-sm text-frz-ink/80">
            <span className="font-medium">{modeLabel}</span>
            {" · "}
            {provider} / {model}
          </p>

          {usage.countsTowardLimit && usage.limit !== null && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-frz-fog overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.remaining === 0 ? "bg-red-400" : "bg-emerald-400"
                  }`}
                  style={{
                    width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-sm text-frz-ink font-medium whitespace-nowrap">
                {usage.used}/{usage.limit}
              </p>
            </div>
          )}

          {usage.countsTowardLimit && usage.limit !== null && (
            <p className="text-xs text-frz-ink/60 mt-2">
              Generări AI azi — plan {usage.planLabel}
              {usage.remaining !== null && usage.remaining > 0 && (
                <>
                  {" "}
                  · <span className="text-frz-ink/80">{usage.remaining} rămase</span>
                </>
              )}
              {usage.remaining === 0 && (
                <>
                  {" "}
                  · <span className="text-red-600">limită atinsă</span>
                </>
              )}{" "}
              — 1 click = 1 generare (3 variante) · reset la miezul nopții
            </p>
          )}

          {usage.countsTowardLimit && usage.unlimited && (
            <p className="text-xs text-frz-ink/60 mt-2">
              Generări AI azi:{" "}
              <span className="text-frz-ink font-medium">{usage.used}</span> (nelimitat, plan{" "}
              {usage.planLabel})
            </p>
          )}

          {provider === "template" && (
            <p className="text-xs text-frz-ink/50 mt-2">
              Mod demo — texte generate din șabloane, fără cost API. Pentru AI real gratuit,
              adaugă <code className="text-frz-ink/70">GEMINI_API_KEY</code> din Google AI Studio.
            </p>
          )}
          {provider === "template" && diagnostics.geminiKeySet && (
            <p className="text-xs text-amber-600 mt-2">
              Cheia Gemini e detectată, dar providerul activ e încă template. Setează{" "}
              <code className="text-amber-800">MARKETING_AI_PROVIDER=gemini</code> în Vercel și
              fă redeploy.
            </p>
          )}
          {provider === "template" && !diagnostics.geminiKeySet && (
            <p className="text-xs text-amber-600 mt-2">
              Cheia nu e încă vizibilă pe server. Verifică în Vercel: env pentru{" "}
              <strong>Preview</strong> (staging), nume exact <code>GEMINI_API_KEY</code>, apoi
              Redeploy.
            </p>
          )}
          {provider === "gemini" && (
            <p className="text-xs text-frz-ink/50 mt-2">
              Google Gemini Free Tier — model recomandat: gemini-3.1-flash-lite.
            </p>
          )}
        </AdminCard>
      )}

      <HistoryList
        items={history}
        loading={historyLoading}
        activeId={activeHistoryId}
        onSelect={handleSelectHistory}
        onRefresh={() => void refreshHistory()}
      />

      <AdminCard className="space-y-4">
        <p className="text-frz-ink/60 text-sm">
          AI-ul folosește datele salonului tău (nume, servicii, link programări) și generează
          3 variante dintr-un click.
        </p>

        {role === "owner" && barbers.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm text-frz-ink/50">Frizer</label>
            <AdminSelect
              value={selectedBarberId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSelectedBarberId(e.target.value)
              }
            >
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </AdminSelect>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-frz-ink/50">Ton</label>
          <div className="flex flex-wrap gap-2">
            {MARKETING_TONES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTone(value)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  tone === value
                    ? "bg-frz-ink text-frz-ink-contrast font-medium"
                    : "bg-frz-fog text-frz-ink/80 hover:bg-frz-mist"
                }`}
              >
                {MARKETING_TONE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-frz-ink/50">Serviciu pentru promovare (opțional)</label>
          <AdminSelect
            value={selectedServiceId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedServiceId(e.target.value)
            }
          >
            <option value="">Alege serviciu</option>
            {barberServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.duration} min)
              </option>
            ))}
          </AdminSelect>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-frz-ink/50">
            Note suplimentare (opțional, max {MARKETING_EXTRA_NOTES_MAX})
          </label>
          <textarea
            value={extraNotes}
            onChange={(e) =>
              setExtraNotes(e.target.value.slice(0, MARKETING_EXTRA_NOTES_MAX))
            }
            placeholder="Ex: vreau ton relaxat, menționează că avem cafea gratuită..."
            rows={3}
            className="w-full bg-frz-fog border border-frz-line rounded-lg px-4 py-3 text-frz-ink placeholder:text-frz-muted resize-y min-h-[80px]"
          />
        </div>
      </AdminCard>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <AdminButton
            key={action.type}
            variant="secondary"
            fullWidth
            loading={loadingType === action.type}
            loadingLabel="Se generează..."
            disabled={
              !usage.unlimited &&
              usage.remaining !== null &&
              usage.remaining <= 0
            }
            onClick={() => handleGenerate(action.type, action.needsService)}
            className="justify-start gap-3 text-left"
          >
            <span className="text-lg">{action.icon}</span>
            <span>
              {action.label}
              {action.seasonal ? (
                <span className="block text-[11px] text-frz-ink/45 font-normal">
                  Sezon actual
                </span>
              ) : null}
            </span>
          </AdminButton>
        ))}
      </div>

      {warning && <p className="text-amber-600 text-sm">{warning}</p>}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {result && (
        <AdminCard className="space-y-4">
          {provider === "template" && (
            <p className="text-xs text-emerald-700">
              Text demo (gratuit) — bun pentru testare. Pentru variante mai creative, folosește
              Gemini Free.
            </p>
          )}

          {variants.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {variants.map((_, index) => (
                <button
                  key={`variant-${index}`}
                  type="button"
                  onClick={() => handleSelectVariant(index)}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    activeVariantIndex === index
                      ? "bg-frz-ink text-frz-ink-contrast font-medium"
                      : "bg-frz-fog text-frz-ink/80 hover:bg-frz-mist"
                  }`}
                >
                  Varianta {index + 1}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{result.title}</h2>
              <p className="text-frz-ink/50 text-sm mt-1">
                {activeHistoryId ? "Din istoric / generare salvată" : "Conținut generat"}
                {" · "}
                Ton {MARKETING_TONE_LABELS[tone]}
              </p>
            </div>
            <AdminButton variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? "Copiat ✔" : "Copiază"}
            </AdminButton>
          </div>

          <div className="whitespace-pre-wrap text-frz-ink/90 text-sm leading-relaxed">
            {result.content}
          </div>

          <div className="pt-2 border-t border-frz-line space-y-2">
            <p className="text-sm font-medium text-frz-ink/80">Call to action</p>
            <p className="text-sm text-frz-ink/70">{result.callToAction}</p>
          </div>

          {result.hashtags.length > 0 && (
            <div className="pt-2 border-t border-frz-line">
              <p className="text-sm font-medium text-frz-ink/80 mb-2">Hashtag-uri</p>
              <p className="text-sm text-sky-300">
                {result.hashtags
                  .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
                  .join(" ")}
              </p>
            </div>
          )}

          <ShareKit
            result={result}
            bookingUrl={branding?.bookingUrl}
            salonName={branding?.salonName || "salon"}
          />

          <BrandedCardButton
            result={result}
            branding={branding}
            contentType={resultContentType}
            onBrandingNeeded={() => loadBranding(selectedBarberId)}
          />
        </AdminCard>
      )}
    </div>
  );
}

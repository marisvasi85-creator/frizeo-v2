"use client";

import { useEffect, useMemo, useState } from "react";
import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import { AdminSelect } from "../components/AdminInput";
import type { BrandedCardBranding } from "@/lib/marketing-ai/brandedCard";
import {
  MARKETING_CHANNEL_LABELS,
  MARKETING_CHANNELS,
  type MarketingChannel,
} from "@/lib/marketing-ai/channels";
import type { MarketingAIHistoryBatch } from "@/lib/marketing-ai/historyTypes";
import { historyItemToResult } from "@/lib/marketing-ai/historyTypes";
import { formatOpenSlotDayHeading } from "@/lib/marketing-ai/openSlotCopy";
import { getSeasonalActions } from "@/lib/marketing-ai/seasonal";
import { copyTextToClipboard } from "@/lib/marketing-ai/share";
import { applyTextAction, type MarketingDraft } from "@/lib/marketing-ai/textActions";
import { withMarketingTracking } from "@/lib/marketing-ai/tracking";
import {
  MARKETING_EXTRA_NOTES_MAX,
  MARKETING_TONE_LABELS,
  MARKETING_TONES,
  isMarketingTone,
  type MarketingContentType,
  type MarketingTone,
  type OpenSlotDayFact,
} from "@/lib/marketing-ai/types";
import BrandedCardButton from "./BrandedCardButton";
import HistoryList from "./HistoryList";
import ShareKit from "./ShareKit";
import SocialLinksBar from "./SocialLinksBar";
import type { SocialLinks } from "@/lib/social/normalizeSocialUrl";

type ServiceOption = { id: string; name: string; duration: number };
type BarberOption = { id: string; name: string };
type Goal = "post" | "work" | "service" | "slots" | "season";

type UsageStatus = {
  used: number;
  limit: number | null;
  remaining: number | null;
  planLabel: string;
  unlimited: boolean;
  countsTowardLimit: boolean;
  migrationReady: boolean;
};

const GOALS: { id: Goal; label: string; hint: string }[] = [
  { id: "post", label: "Postare", hint: "Text general pentru salon" },
  { id: "work", label: "O lucrare", hint: "Arată ce ai făcut, fără să inventăm tunsoarea" },
  { id: "service", label: "Un serviciu", hint: "Pornește de la un serviciu real" },
  { id: "slots", label: "Locurile libere", hint: "Text pe baza locurilor disponibile" },
  { id: "season", label: "Sezon / ocazie", hint: "Doar când ocazia e aproape" },
];

const QUICK_ACTIONS = [
  { id: "shorter", label: "Mai scurt" },
  { id: "direct", label: "Mai direct" },
  { id: "no_price", label: "Fără preț" },
  { id: "no_emoji", label: "Fără emoji" },
  { id: "emoji", label: "Cu emoji" },
  { id: "link_in_bio", label: "Link în bio" },
  { id: "whatsapp", label: "WhatsApp" },
];

function linksForBatch(bookingUrl: string | null | undefined, batchId: string) {
  if (!bookingUrl) return {};
  const links: Record<string, string> = {};
  for (const source of ["instagram", "facebook", "tiktok", "whatsapp", "qr", "story"] as const) {
    links[source] =
      withMarketingTracking(bookingUrl, { source, batchId }) || bookingUrl;
  }
  return links;
}

function resolveContentType(
  goal: Goal,
  channel: MarketingChannel,
  occasion: MarketingContentType,
): MarketingContentType {
  if (goal === "season") return occasion;
  if (goal === "service") return "service_promo";
  if (goal === "work") return "work_promo";
  if (goal === "slots") return "open_slots";
  if (channel === "reel") return "reel";
  if (channel === "story") return "story";
  return "instagram_post";
}

export default function MarketingAIClient({
  role,
  barbers,
  services,
  defaultBarberId,
  demoMode,
  usage: initialUsage,
  initialSocialLinks,
  initialHistory,
}: {
  role: string | null;
  barbers: BarberOption[];
  services: ServiceOption[];
  defaultBarberId: string;
  demoMode: boolean;
  usage: UsageStatus;
  initialSocialLinks: SocialLinks;
  initialHistory: MarketingAIHistoryBatch[];
}) {
  const seasonal = useMemo(() => getSeasonalActions(), []);
  const [usage, setUsage] = useState(initialUsage);
  const [goal, setGoal] = useState<Goal>("post");
  const [occasion, setOccasion] = useState<MarketingContentType>(
    seasonal[0]?.type || "birthday_offer",
  );
  const [channel, setChannel] = useState<MarketingChannel>("instagram");
  const [selectedBarberId, setSelectedBarberId] = useState(defaultBarberId);
  const [barberServices, setBarberServices] = useState(services);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [tone, setTone] = useState<MarketingTone>("relaxed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [resultContentType, setResultContentType] = useState<string | null>(null);
  const [exportChannel, setExportChannel] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [savedTone, setSavedTone] = useState<string | null>(null);
  const [savedServiceName, setSavedServiceName] = useState<string | null>(null);
  const [availability, setAvailability] = useState<OpenSlotDayFact[] | null>(null);
  const [trackedLinks, setTrackedLinks] = useState<Record<string, string>>({});
  const [branding, setBranding] = useState<BrandedCardBranding | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(initialSocialLinks);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canPickBarber =
    (role === "owner" || role === "manager") && barbers.length > 1;
  const draft = drafts[activeVariantIndex] || null;
  const quotaBlocked =
    !usage.unlimited && usage.remaining !== null && usage.remaining <= 0;

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

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
    let cancelled = false;
    fetch(`/api/marketing-ai/branding?barberId=${selectedBarberId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.salonName) return;
        setSocialLinks({
          instagram: data.socialLinks?.instagram ?? null,
          facebook: data.socialLinks?.facebook ?? null,
          tiktok: data.socialLinks?.tiktok ?? null,
        });
        setBranding({
          salonName: data.salonName,
          barberName: data.barberName,
          logoUrl: data.logoUrl,
          bookingUrl: data.bookingUrl,
        });
      })
      .catch(() => {
        if (!cancelled) setBranding(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBarberId]);

  async function refreshHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/marketing-ai/history?limit=20");
      const data = await res.json();
      if (res.ok && Array.isArray(data.batches)) setHistory(data.batches);
    } catch {
      // keep the list already on screen
    } finally {
      setHistoryLoading(false);
    }
  }

  const fullText = useMemo(() => {
    if (!draft) return "";
    const tags = draft.hashtags.length
      ? `\n\n${draft.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}`
      : "";
    return `${draft.content}\n\n${draft.callToAction}${tags}`;
  }, [draft]);

  function updateDraft(patch: Partial<MarketingDraft>) {
    setDrafts((current) =>
      current.map((item, index) =>
        index === activeVariantIndex ? { ...item, ...patch } : item,
      ),
    );
  }

  async function handleGenerate() {
    setError("");
    setWarning("");
    setCopied(false);

    if (goal === "service" && !selectedServiceId) {
      setError("Alege serviciul pe care vrei să-l promovezi.");
      return;
    }
    if (goal === "season" && !occasion) {
      setError("Alege ocazia.");
      return;
    }

    const contentType = resolveContentType(goal, channel, occasion);
    setLoading(true);
    try {
      const res = await fetch("/api/marketing-ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          channel,
          barberId: selectedBarberId,
          serviceId: selectedServiceId || undefined,
          extraNotes: extraNotes.trim() || undefined,
          tone,
        }),
      });
      const data = await res.json();
      if (data.usage) setUsage(data.usage);
      if (!res.ok || data.emptyAvailability) {
        setDrafts([]);
        setActiveHistoryId(null);
        throw new Error(data.error || "Nu am putut genera textul");
      }

      const next: MarketingDraft[] = Array.isArray(data.variants) ? data.variants : [];
      setDrafts(next);
      setActiveVariantIndex(0);
      setResultContentType(data.contentType || contentType);
      setExportChannel(channel);
      setActiveHistoryId(data.batchId || null);
      setSavedTone(data.tone || tone);
      setSavedServiceName(data.serviceName || null);
      setAvailability(Array.isArray(data.availability) ? data.availability : null);
      setTrackedLinks(data.trackedLinks || {});
      if (data.warning) setWarning(data.warning);
      void refreshHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eroare la generare");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectHistory(batch: MarketingAIHistoryBatch) {
    setError("");
    setWarning("");
    setCopied(false);
    setDrafts(batch.variants.map(historyItemToResult));
    setActiveVariantIndex(0);
    setResultContentType(batch.contentType);
    setExportChannel(batch.channel);
    setActiveHistoryId(batch.id);
    setSavedTone(batch.tone);
    setSavedServiceName(batch.serviceName);
    setAvailability(batch.availability);
    setTrackedLinks(linksForBatch(branding?.bookingUrl, batch.id));
  }

  function handleQuickAction(action: string) {
    if (!draft) return;
    const bookingUrl =
      action === "whatsapp"
        ? trackedLinks.whatsapp || branding?.bookingUrl
        : trackedLinks.instagram || branding?.bookingUrl;
    const next = applyTextAction(action, draft, bookingUrl);
    if (!next) return;
    updateDraft(next);
  }

  async function handleCopy() {
    if (!fullText) return;
    await copyTextToClipboard(fullText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const occasions: { type: MarketingContentType; label: string }[] = [
    { type: "birthday_offer", label: "Aniversarea salonului" },
    ...seasonal.map((action) => ({ type: action.type, label: action.label })),
  ];

  const savedToneLabel =
    savedTone && isMarketingTone(savedTone)
      ? MARKETING_TONE_LABELS[savedTone]
      : "Ton nesalvat";

  return (
    <div className="space-y-6 max-w-3xl">
      <SocialLinksBar links={socialLinks} />

      <AdminCard>
        <p className="text-sm text-frz-ink/80">
          Marketing AI îți scrie postările pentru salon, pe datele tale reale.
        </p>
        {demoMode && (
          <p className="text-xs text-frz-muted mt-2">
            Acum textele pornesc din șabloane locale.
          </p>
        )}
        {usage.countsTowardLimit && usage.limit !== null && (
          <p className="text-xs text-frz-ink/60 mt-3">
            {usage.used}/{usage.limit} generări azi · plan {usage.planLabel}
            {usage.remaining === 0 ? " · limită atinsă" : ""}
            {" · "}1 click = 1 generare, chiar dacă primești 3 variante
          </p>
        )}
      </AdminCard>

      <HistoryList
        batches={history}
        loading={historyLoading}
        activeId={activeHistoryId}
        onSelect={handleSelectHistory}
        onRefresh={() => void refreshHistory()}
      />

      <AdminCard className="space-y-4">
        <p className="text-sm font-medium text-frz-ink">Ce vrei să promovezi?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {GOALS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setGoal(item.id)}
              className={`rounded-xl px-3 py-3 text-left border ${
                goal === item.id
                  ? "border-frz-ink bg-frz-mist"
                  : "border-frz-line bg-frz-fog"
              }`}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block text-xs text-frz-muted mt-1">{item.hint}</span>
            </button>
          ))}
        </div>

        {goal === "season" && (
          <div className="space-y-2">
            <label className="text-sm text-frz-ink/50">Ocazie</label>
            <AdminSelect
              value={occasion}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setOccasion(event.target.value as MarketingContentType)
              }
            >
              {occasions.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.label}
                </option>
              ))}
            </AdminSelect>
            {seasonal.length === 0 && (
              <p className="text-xs text-frz-muted">
                În perioada asta nu e un sezon activ. Poți folosi aniversarea salonului.
              </p>
            )}
          </div>
        )}

        {canPickBarber && (
          <div className="space-y-2">
            <label className="text-sm text-frz-ink/50">Frizer</label>
            <AdminSelect
              value={selectedBarberId}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setSelectedBarberId(event.target.value)
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
          <label className="text-sm text-frz-ink/50">
            {goal === "service" ? "Serviciu" : "Serviciu (opțional)"}
          </label>
          <AdminSelect
            value={selectedServiceId}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedServiceId(event.target.value)
            }
          >
            {goal === "service" ? null : <option value="">Fără un serviciu anume</option>}
            {barberServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.duration} min)
              </option>
            ))}
          </AdminSelect>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-frz-ink/50">Ton pentru generarea următoare</label>
          <div className="flex flex-wrap gap-2">
            {MARKETING_TONES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTone(value)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  tone === value
                    ? "bg-frz-ink text-frz-ink-contrast font-medium"
                    : "bg-frz-fog text-frz-ink/80"
                }`}
              >
                {MARKETING_TONE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-frz-ink/50">Unde o pui</label>
          <div className="flex flex-wrap gap-2">
            {MARKETING_CHANNELS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setChannel(value)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  channel === value
                    ? "bg-frz-ink text-frz-ink-contrast font-medium"
                    : "bg-frz-fog text-frz-ink/80"
                }`}
              >
                {MARKETING_CHANNEL_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-frz-ink/50">
            Note (opțional, max {MARKETING_EXTRA_NOTES_MAX})
          </label>
          <textarea
            value={extraNotes}
            onChange={(event) =>
              setExtraNotes(event.target.value.slice(0, MARKETING_EXTRA_NOTES_MAX))
            }
            placeholder={
              goal === "work"
                ? "Ex: burst fade, păr deschis, client nou"
                : "Ex: menționează că avem cafea"
            }
            rows={3}
            className="w-full bg-frz-fog border border-frz-line rounded-lg px-4 py-3 text-frz-ink placeholder:text-frz-muted"
          />
        </div>

        {goal === "work" && (
          <div className="space-y-2">
            <label className="text-sm text-frz-ink/50">Poză (opțional, rămâne pe telefon)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (photoUrl) URL.revokeObjectURL(photoUrl);
                setPhotoUrl(file ? URL.createObjectURL(file) : null);
              }}
            />
            <p className="text-xs text-frz-muted">
              Poza e doar pentru previzualizare și card. Nu o analizăm și nu o încărcăm.
            </p>
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Lucrarea selectată" className="max-h-48 rounded-lg" />
            )}
          </div>
        )}

        <AdminButton
          onClick={handleGenerate}
          loading={loading}
          loadingLabel="Se scrie..."
          disabled={quotaBlocked || !selectedBarberId}
        >
          Generează 3 variante
        </AdminButton>
      </AdminCard>

      {warning && <p className="text-amber-600 text-sm">{warning}</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {draft && (
        <AdminCard className="space-y-4">
          {drafts.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {drafts.map((_, index) => (
                <button
                  key={`variant-${index}`}
                  type="button"
                  onClick={() => setActiveVariantIndex(index)}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    activeVariantIndex === index
                      ? "bg-frz-ink text-frz-ink-contrast font-medium"
                      : "bg-frz-fog"
                  }`}
                >
                  Varianta {index + 1}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <input
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.target.value.slice(0, 80) })}
                className="text-lg font-semibold bg-transparent w-full"
              />
              <p className="text-frz-ink/50 text-sm mt-1">
                Ton folosit: {savedToneLabel}
                {savedServiceName ? ` · ${savedServiceName}` : ""}
              </p>
            </div>
            <AdminButton variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? "Copiat" : "Copiază"}
            </AdminButton>
          </div>

          {availability && availability.length > 0 && (
            <div className="text-sm text-frz-muted space-y-1">
              <p className="font-medium text-frz-ink">
                Locuri disponibile în următoarele 7 zile
              </p>
              <ul className="space-y-0.5">
                {availability.map((day) => (
                  <li key={day.date}>{formatOpenSlotDayHeading(day)}</li>
                ))}
              </ul>
            </div>
          )}

          <textarea
            value={draft.content}
            onChange={(event) => updateDraft({ content: event.target.value })}
            rows={8}
            className="w-full bg-frz-fog border border-frz-line rounded-lg px-4 py-3 text-sm"
          />
          <textarea
            value={draft.callToAction}
            onChange={(event) => updateDraft({ callToAction: event.target.value })}
            rows={2}
            className="w-full bg-frz-fog border border-frz-line rounded-lg px-4 py-3 text-sm"
          />

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleQuickAction(action.id)}
                className="rounded-lg px-3 py-2 text-xs bg-frz-fog"
              >
                {action.label}
              </button>
            ))}
          </div>

          {draft.hashtags.length > 0 && (
            <p className="text-sm text-sky-300">
              {draft.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}
            </p>
          )}

          <ShareKit
            result={draft}
            bookingUrl={trackedLinks.instagram || branding?.bookingUrl}
            whatsappUrl={trackedLinks.whatsapp || branding?.bookingUrl}
            qrUrl={trackedLinks.qr || branding?.bookingUrl}
            salonName={branding?.salonName || "salon"}
          />
          <BrandedCardButton
            result={draft}
            branding={branding}
            contentType={resultContentType}
            channel={exportChannel}
            photoUrl={goal === "work" ? photoUrl : null}
            onBrandingNeeded={async () => branding}
          />
        </AdminCard>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import { AdminSelect } from "../components/AdminInput";
import type { MarketingContentType } from "@/lib/marketing-ai/types";
import type { BrandedCardBranding } from "@/lib/marketing-ai/brandedCard";
import BrandedCardButton from "./BrandedCardButton";

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

const ACTIONS: Array<{
  type: MarketingContentType;
  label: string;
  icon: string;
  needsService?: boolean;
}> = [
  { type: "instagram_post", label: "Generează postare Instagram", icon: "📸" },
  { type: "reel", label: "Generează Reel", icon: "🎥" },
  { type: "story", label: "Generează Story", icon: "📖" },
  { type: "christmas_promo", label: "Generează promoție de Crăciun", icon: "🎄" },
  { type: "service_promo", label: "Promovează serviciul", icon: "💈", needsService: true },
  { type: "birthday_offer", label: "Generează ofertă de aniversare", icon: "🎂" },
];

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
}) {
  const [usage, setUsage] = useState(initialUsage);
  const [selectedBarberId, setSelectedBarberId] = useState(defaultBarberId);
  const [barberServices, setBarberServices] = useState(services);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [loadingType, setLoadingType] = useState<MarketingContentType | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [branding, setBranding] = useState<BrandedCardBranding | null>(null);

  async function loadBranding(barberId: string): Promise<BrandedCardBranding | null> {
    const res = await fetch(`/api/marketing-ai/branding?barberId=${barberId}`);
    const data = await res.json();
    if (!res.ok) return null;

    const next: BrandedCardBranding = {
      salonName: data.salonName,
      barberName: data.barberName,
      logoUrl: data.logoUrl,
      bookingUrl: data.bookingUrl,
    };
    setBranding(next);
    return next;
  }

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
          (data.services || []).map((service: { id: string; display_name?: string; name: string; duration: number }) => ({
            id: service.id,
            name: service.display_name || service.name,
            duration: service.duration,
          })),
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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.usage) {
          setUsage(data.usage);
        }
        throw new Error(data.error || "Nu am putut genera conținutul");
      }

      setResult(data.result);
      if (data.warning) {
        setWarning(data.warning);
      }
      if (data.usage) {
        setUsage(data.usage);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eroare la generare");
      setResult(null);
    } finally {
      setLoadingType(null);
    }
  }

  async function handleCopy() {
    if (!fullText) return;
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {!configured && (
        <AdminCard className="border-amber-500/30 bg-amber-500/10">
          <p className="text-amber-100 text-sm">
            Marketing AI nu este configurat. Setează un provider în Vercel sau lasă implicit{" "}
            <code className="text-amber-50">template</code> pentru testare gratuită.
          </p>
        </AdminCard>
      )}

      {configured && (
        <AdminCard
          className={
            isFreeTier
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-white/10"
          }
        >
          <p className="text-sm text-white/80">
            <span className="font-medium">{modeLabel}</span>
            {" · "}
            {provider} / {model}
          </p>

          {!usage.unlimited && usage.limit !== null && (
            <p className="text-xs text-white/60 mt-2">
              Generări AI azi:{" "}
              <span className="text-white font-medium">
                {usage.used}/{usage.limit}
              </span>{" "}
              (plan {usage.planLabel}) — se resetează la miezul nopții
            </p>
          )}

          {usage.unlimited && usage.countsTowardLimit && (
            <p className="text-xs text-white/60 mt-2">
              Generări AI nelimitate (plan {usage.planLabel})
            </p>
          )}

          {!usage.migrationReady && usage.countsTowardLimit && (
            <p className="text-xs text-amber-300 mt-2">
              Limitele zilnice se activează după migrarea DB marketing_ai_generations.
            </p>
          )}
          {provider === "template" && (
            <p className="text-xs text-white/50 mt-2">
              Mod demo — texte generate din șabloane, fără cost API. Pentru AI real gratuit,
              adaugă <code className="text-white/70">GEMINI_API_KEY</code> din Google AI Studio.
            </p>
          )}
          {provider === "template" && diagnostics.geminiKeySet && (
            <p className="text-xs text-amber-300 mt-2">
              Cheia Gemini e detectată, dar providerul activ e încă template. Setează{" "}
              <code className="text-amber-100">MARKETING_AI_PROVIDER=gemini</code> în Vercel și
              fă redeploy.
            </p>
          )}
          {provider === "template" && !diagnostics.geminiKeySet && (
            <p className="text-xs text-amber-300 mt-2">
              Cheia nu e încă vizibilă pe server. Verifică în Vercel: env pentru{" "}
              <strong>Preview</strong> (staging), nume exact <code>GEMINI_API_KEY</code>, apoi
              Redeploy.
            </p>
          )}
          {provider === "gemini" && (
            <p className="text-xs text-white/50 mt-2">
              Google Gemini Free Tier — model recomandat: gemini-3.1-flash-lite.
            </p>
          )}
        </AdminCard>
      )}

      <AdminCard className="space-y-4">
        <p className="text-white/60 text-sm">
          AI-ul folosește datele salonului tău (nume, servicii, link programări) pentru a
          crea texte gata de postat.
        </p>

        {role === "owner" && barbers.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm text-white/50">Frizer</label>
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
          <label className="text-sm text-white/50">Serviciu pentru promovare (opțional)</label>
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
          <label className="text-sm text-white/50">Note suplimentare (opțional)</label>
          <textarea
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="Ex: vreau ton relaxat, menționează că avem cafea gratuită..."
            rows={3}
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 resize-y min-h-[80px]"
          />
        </div>
      </AdminCard>

      <div className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((action) => (
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
            <span>{action.label}</span>
          </AdminButton>
        ))}
      </div>

      {warning && (
        <p className="text-amber-300 text-sm">{warning}</p>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {result && (
        <AdminCard className="space-y-4">
          {provider === "template" && (
            <p className="text-xs text-emerald-300/90">
              Text demo (gratuit) — bun pentru testare. Pentru variante mai creative, folosește
              Gemini Free.
            </p>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{result.title}</h2>
              <p className="text-white/50 text-sm mt-1">Conținut generat</p>
            </div>
            <AdminButton variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? "Copiat ✔" : "Copiază"}
            </AdminButton>
          </div>

          <div className="whitespace-pre-wrap text-white/90 text-sm leading-relaxed">
            {result.content}
          </div>

          <div className="pt-2 border-t border-white/10 space-y-2">
            <p className="text-sm font-medium text-white/80">Call to action</p>
            <p className="text-sm text-white/70">{result.callToAction}</p>
          </div>

          {result.hashtags.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <p className="text-sm font-medium text-white/80 mb-2">Hashtag-uri</p>
              <p className="text-sm text-sky-300">
                {result.hashtags
                  .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
                  .join(" ")}
              </p>
            </div>
          )}

          <BrandedCardButton
            result={result}
            branding={branding}
            onBrandingNeeded={() => loadBranding(selectedBarberId)}
          />
        </AdminCard>
      )}
    </div>
  );
}

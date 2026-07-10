"use client";

import { useEffect, useMemo, useState } from "react";
import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import { AdminSelect } from "../components/AdminInput";
import type { MarketingContentType } from "@/lib/marketing-ai/types";

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

export default function MarketingAIClient({
  role,
  barbers,
  services,
  defaultBarberId,
  configured,
}: {
  role: string | null;
  barbers: BarberOption[];
  services: ServiceOption[];
  defaultBarberId: string;
  configured: boolean;
}) {
  const [selectedBarberId, setSelectedBarberId] = useState(defaultBarberId);
  const [barberServices, setBarberServices] = useState(services);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [loadingType, setLoadingType] = useState<MarketingContentType | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [copied, setCopied] = useState(false);

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

  const fullText = useMemo(() => {
    if (!result) return "";
    const tags = result.hashtags.length
      ? `\n\n${result.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}`
      : "";
    return `${result.content}\n\n${result.callToAction}${tags}`;
  }, [result]);

  async function handleGenerate(type: MarketingContentType, needsService?: boolean) {
    setError("");
    setCopied(false);

    if (!configured) {
      setError("Marketing AI nu este configurat pe server (lipsește OPENAI_API_KEY).");
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
        throw new Error(data.error || "Nu am putut genera conținutul");
      }

      setResult(data.result);
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
            Marketing AI necesită <code className="text-amber-50">OPENAI_API_KEY</code> în
            environment-ul Vercel (staging). Fără cheie, butoanele nu vor genera conținut.
          </p>
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
            onClick={() => handleGenerate(action.type, action.needsService)}
            className="justify-start gap-3 text-left"
          >
            <span className="text-lg">{action.icon}</span>
            <span>{action.label}</span>
          </AdminButton>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {result && (
        <AdminCard className="space-y-4">
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
        </AdminCard>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import AdminButton from "../components/AdminButton";
import {
  downloadBrandedCard,
  renderBrandedCardToBlob,
  type BrandedCardBranding,
} from "@/lib/marketing-ai/brandedCard";

export default function BrandedCardButton({
  result,
  branding,
  onBrandingNeeded,
}: {
  result: {
    title: string;
    content: string;
    callToAction: string;
  };
  branding: BrandedCardBranding | null;
  onBrandingNeeded: () => Promise<BrandedCardBranding | null>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setError("");
    setLoading(true);

    try {
      let cardBranding = branding;
      if (!cardBranding) {
        cardBranding = await onBrandingNeeded();
      }

      if (!cardBranding) {
        throw new Error("Nu am putut încărca datele salonului.");
      }

      const blob = await renderBrandedCardToBlob({
        ...cardBranding,
        title: result.title,
        content: result.content,
        callToAction: result.callToAction,
      });

      downloadBrandedCard(blob, cardBranding.salonName);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eroare la generarea imaginii");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pt-2 border-t border-white/10 space-y-2">
      <p className="text-sm font-medium text-white/80">Imagine promo (gratuit)</p>
      <p className="text-xs text-white/50">
        Card 1080×1080 cu logo salon, text și link programări — gata de postat pe Instagram.
      </p>
      <AdminButton
        variant="secondary"
        size="sm"
        loading={loading}
        loadingLabel="Se creează imaginea..."
        onClick={handleDownload}
      >
        Descarcă card promo PNG
      </AdminButton>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

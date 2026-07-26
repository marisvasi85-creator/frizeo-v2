"use client";

import { useState } from "react";
import AdminButton from "../components/AdminButton";
import {
  downloadBrandedCard,
  getBrandedCardFormatMeta,
  renderBrandedCardToBlob,
  type BrandedCardBranding,
  type BrandedCardFormat,
} from "@/lib/marketing-ai/brandedCard";
import type { MarketingContentType } from "@/lib/marketing-ai/types";

function defaultFormatForType(
  contentType?: MarketingContentType | string | null,
): BrandedCardFormat {
  return contentType === "story" ? "story" : "square";
}

export default function BrandedCardButton({
  result,
  branding,
  contentType,
  onBrandingNeeded,
}: {
  result: {
    title: string;
    content: string;
    callToAction: string;
  };
  branding: BrandedCardBranding | null;
  contentType?: MarketingContentType | string | null;
  onBrandingNeeded: () => Promise<BrandedCardBranding | null>;
}) {
  const [loadingFormat, setLoadingFormat] = useState<BrandedCardFormat | null>(
    null,
  );
  const [error, setError] = useState("");
  const preferred = defaultFormatForType(contentType);

  async function handleDownload(format: BrandedCardFormat) {
    setError("");
    setLoadingFormat(format);

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
        format,
      });

      downloadBrandedCard(blob, cardBranding.salonName, format);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eroare la generarea imaginii");
    } finally {
      setLoadingFormat(null);
    }
  }

  const squareMeta = getBrandedCardFormatMeta("square");
  const storyMeta = getBrandedCardFormatMeta("story");

  return (
    <div className="pt-2 border-t border-white/10 space-y-2">
      <p className="text-sm font-medium text-white/80">Imagine promo (gratuit)</p>
      <p className="text-xs text-white/50">
        Card cu logo, text și link programări — {squareMeta.label} pentru feed,{" "}
        {storyMeta.label} pentru Stories.
        {preferred === "story" && (
          <> Pentru tipul Story, recomandăm formatul vertical.</>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <AdminButton
          variant={preferred === "square" ? "primary" : "secondary"}
          size="sm"
          loading={loadingFormat === "square"}
          loadingLabel="Se creează imaginea..."
          onClick={() => handleDownload("square")}
        >
          Descarcă post ({squareMeta.label})
        </AdminButton>
        <AdminButton
          variant={preferred === "story" ? "primary" : "secondary"}
          size="sm"
          loading={loadingFormat === "story"}
          loadingLabel="Se creează imaginea..."
          onClick={() => handleDownload("story")}
        >
          Descarcă Story ({storyMeta.label})
        </AdminButton>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

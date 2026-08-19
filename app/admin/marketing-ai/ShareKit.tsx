"use client";

import { useState } from "react";
import AdminButton from "../components/AdminButton";
import {
  buildShareCaption,
  buildWhatsAppShareUrl,
  copyTextToClipboard,
} from "@/lib/marketing-ai/share";
import { downloadQrPng, renderBookingQrToBlob } from "@/lib/marketing-ai/qrCode";

export default function ShareKit({
  result,
  bookingUrl,
  salonName,
}: {
  result: {
    content: string;
    callToAction: string;
    hashtags: string[];
  };
  bookingUrl: string | null | undefined;
  salonName: string;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState("");

  const caption = buildShareCaption({
    content: result.content,
    callToAction: result.callToAction,
    hashtags: result.hashtags,
    bookingUrl,
  });

  async function handleCopyLink() {
    if (!bookingUrl) {
      setError("Link-ul de programări nu este disponibil.");
      return;
    }
    setError("");
    await copyTextToClipboard(bookingUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  }

  async function handleCopyCaption() {
    setError("");
    await copyTextToClipboard(caption);
    setCopiedCaption(true);
    window.setTimeout(() => setCopiedCaption(false), 2000);
  }

  function handleWhatsApp() {
    window.open(buildWhatsAppShareUrl(caption), "_blank", "noopener,noreferrer");
  }

  async function handleQrDownload() {
    if (!bookingUrl) {
      setError("Link-ul de programări nu este disponibil.");
      return;
    }

    setError("");
    setQrLoading(true);
    try {
      const blob = await renderBookingQrToBlob(bookingUrl);
      downloadQrPng(blob, salonName);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nu am putut genera QR-ul");
    } finally {
      setQrLoading(false);
    }
  }

  return (
    <div className="pt-2 border-t border-white/10 space-y-3">
      <div>
        <p className="text-sm font-medium text-frz-ink">Distribuie rapid</p>
        <p className="text-xs text-frz-muted mt-1">
          Copiază textul, trimite pe WhatsApp sau descarcă QR pentru afiș / oglindă.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <AdminButton variant="secondary" size="sm" onClick={handleCopyCaption}>
          {copiedCaption ? "Text copiat ✔" : "Copiază textul"}
        </AdminButton>
        <AdminButton
          variant="secondary"
          size="sm"
          onClick={handleCopyLink}
          disabled={!bookingUrl}
        >
          {copiedLink ? "Link copiat ✔" : "Copiază link programări"}
        </AdminButton>
        <AdminButton variant="secondary" size="sm" onClick={handleWhatsApp}>
          Trimite pe WhatsApp
        </AdminButton>
        <AdminButton
          variant="secondary"
          size="sm"
          loading={qrLoading}
          loadingLabel="Se generează QR..."
          onClick={handleQrDownload}
          disabled={!bookingUrl}
        >
          Descarcă QR booking
        </AdminButton>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
